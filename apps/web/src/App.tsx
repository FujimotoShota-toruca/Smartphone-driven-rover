import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { BLE_GATT_CONTRACT, type RoverPacket } from "@smartphone-rover/protocol";
import {
  CommandAuthorizationPipeline,
} from "@smartphone-rover/mission-db/CommandAuthorizationPipeline";
import {
  CommandRegistry,
} from "@smartphone-rover/mission-db/CommandRegistry";
import type {
  MissionProfileDefinition,
  BoardProfileDefinition,
  SafetyDefinition,
  MissionDbHashes,
} from "@smartphone-rover/mission-db/types";

import { sendHeartbeatIfIdle } from "./heartbeat/HeartbeatScheduler";
import { ManualCommandRepeater, type ManualCommand } from "./manual/ManualCommandRepeater";
import { manualDriveCommands } from "./manual/manualDriveCommands";
import { createCmdVelPacket } from "./packet/createCmdVelPacket";
import { createEmergencyStopPacket } from "./packet/createEmergencyStopPacket";
import { createHeartbeatPacket } from "./packet/createHeartbeatPacket";
import { MockRoverTransport } from "./transport/MockRoverTransport";
import type { RoverTransport } from "./transport/RoverTransport";
import { isWebBluetoothAvailable } from "./transport/BluetoothAvailability";
import { WebBluetoothTransport } from "./transport/WebBluetoothTransport";

interface LogEntry {
  id: number;
  status: "sent" | "rejected" | "system";
  message: string;
}

type TransportMode = "mock" | "web_bluetooth";

const schema: MissionDbHashes = {
  core_protocol_hash: "mock-core-v1",
  mission_db_hash: "mock-mission-v1",
  board_profile_hash: "mock-board-v1",
};

const missionProfile: MissionProfileDefinition = {
  schema_version: 1,
  mission_profile: {
    name: "engineering_rover_demo",
    enabled_capabilities: ["ble_control", "manual_control", "telemetry"],
    policy: {
      manual_override_allowed: true,
      remote_manual_cmd_allowed: true,
      remote_uplink_allowed: true,
    },
  },
};

const boardProfile: BoardProfileDefinition = {
  schema_version: 1,
  board_profile: {
    name: "minimal_2wheel_pico_board",
    capabilities: {
      drive_control: true,
      safety_supervisor: true,
      ble_link: true,
      local_telemetry: true,
    },
  },
};

const safetyPolicy: SafetyDefinition = {
  schema_version: 1,
  fixed_safety_kernel: {
    estop: { enabled: true, latch: true },
  },
  policy_defaults: {
    max_vx: 1.0,
    max_wz: 1.0,
    cmd_vel_default_ttl_ms: 300,
    release_allowed_modes: ["MANUAL"],
  },
};

const registry = new CommandRegistry({
  commands: ["cmd_vel"],
  telemetry: ["pico_hk"],
});
const manualRepeatIntervalMs = 120;

export function App() {
  const transportRef = useRef<RoverTransport>(new MockRoverTransport());
  const heartbeatInFlightRef = useRef(false);
  const manualRepeaterRef = useRef<ManualCommandRepeater | null>(null);
  const manualSendCommandRef = useRef<(command: ManualCommand) => void>(() => undefined);
  const manualSendStopRef = useRef<() => void>(() => undefined);
  const seqRef = useRef(1);
  const bluetoothAvailable = useMemo(() => isWebBluetoothAvailable(), []);
  const [transportMode, setTransportMode] = useState<TransportMode>("mock");
  const [missionId, setMissionId] = useState("engineering_rover_demo");
  const [roverId, setRoverId] = useState("rover_01");
  const [connected, setConnected] = useState(false);
  const [heartbeatRunning, setHeartbeatRunning] = useState(false);
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState<number | null>(null);
  const [manualRepeatRunning, setManualRepeatRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastPacket, setLastPacket] = useState<RoverPacket | null>(null);

  const pipeline = useMemo(() => new CommandAuthorizationPipeline(), []);

  manualRepeaterRef.current ??= new ManualCommandRepeater({
    intervalMs: manualRepeatIntervalMs,
    sendCommand: (command) => manualSendCommandRef.current(command),
    sendStop: () => manualSendStopRef.current(),
  });

  useEffect(() => {
    if (!connected || transportMode !== "web_bluetooth") {
      setHeartbeatRunning(false);
      return;
    }

    let cancelled = false;

    async function sendHeartbeat() {
      const packet = createHeartbeatPacket({
        missionId,
        roverId,
        seq: nextSeq(),
        ttlMs: BLE_GATT_CONTRACT.heartbeatTimeoutMs,
        schema,
      });
      const result = pipeline.evaluate({
        packet,
        missionProfile,
        boardProfile,
        safetyPolicy,
        currentHashes: schema,
        registry,
        origin: "local_phone",
        mode: "MANUAL",
      });

      if (!result.authorized) {
        appendLog("rejected", `heartbeat rejected at ${result.stage}: ${result.reason}`);
        return;
      }

      try {
        const sent = await sendHeartbeatIfIdle({
          transport: transportRef.current,
          packet,
          inFlight: heartbeatInFlightRef,
        });
        if (sent && !cancelled) {
          setLastHeartbeatAt(packet.timestamp_ms);
        }
      } catch (error) {
        appendLog("rejected", error instanceof Error ? error.message : String(error));
      }
    }

    setHeartbeatRunning(true);
    void sendHeartbeat();
    const intervalId = window.setInterval(() => {
      void sendHeartbeat();
    }, BLE_GATT_CONTRACT.heartbeatPeriodMs);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      heartbeatInFlightRef.current = false;
      setHeartbeatRunning(false);
    };
  }, [connected, transportMode, missionId, roverId, pipeline]);

  useEffect(() => {
    return () => {
      manualRepeaterRef.current?.cancel();
    };
  }, []);

  function appendLog(status: LogEntry["status"], message: string) {
    setLogs((current) => [
      {
        id: Date.now() + Math.random(),
        status,
        message,
      },
      ...current,
    ].slice(0, 24));
  }

  async function connect() {
    await transportRef.current.connect();
    setConnected(true);
    appendLog("system", `${transportLabel(transportMode)} connected`);
  }

  async function disconnect() {
    stopManualRepeat({ sendStop: false });
    await transportRef.current.disconnect();
    setConnected(false);
    heartbeatInFlightRef.current = false;
    setHeartbeatRunning(false);
    appendLog("system", `${transportLabel(transportMode)} disconnected`);
  }

  async function changeTransportMode(mode: TransportMode) {
    if (mode === transportMode) {
      return;
    }

    if (connected) {
      stopManualRepeat({ sendStop: false });
      await transportRef.current.disconnect();
      setConnected(false);
      heartbeatInFlightRef.current = false;
    }

    transportRef.current =
      mode === "web_bluetooth" ? new WebBluetoothTransport() : new MockRoverTransport();
    setTransportMode(mode);
    appendLog("system", `Transport mode: ${transportLabel(mode)}`);
  }

  async function authorizeAndSend(
    packet: RoverPacket,
    options: { logSent?: boolean; logLabel?: string } = {},
  ): Promise<boolean> {
    const result = pipeline.evaluate({
      packet,
      missionProfile,
      boardProfile,
      safetyPolicy,
      currentHashes: schema,
      registry,
      origin: "local_phone",
      mode: "MANUAL",
    });

    if (!result.authorized) {
      appendLog("rejected", `${packet.msg_type} rejected at ${result.stage}: ${result.reason}`);
      return false;
    }

    try {
      await transportRef.current.send(packet);
      setLastPacket(packet);
      if (options.logSent ?? true) {
        appendLog("sent", options.logLabel ?? `${packet.msg_type} sent seq=${packet.seq}`);
      }
      return true;
    } catch (error) {
      appendLog("rejected", error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  function nextSeq() {
    const seq = seqRef.current;
    seqRef.current += 1;
    return seq;
  }

  function sendCmd(
    vx: number,
    wz: number,
    brake = false,
    options: { logSent?: boolean; logLabel?: string } = {},
  ) {
    void authorizeAndSend(
      createCmdVelPacket({
        missionId,
        roverId,
        seq: nextSeq(),
        vx,
        wz,
        brake,
        ttlMs: 300,
        schema,
      }),
      options,
    );
  }

  manualSendCommandRef.current = (command) => {
    sendCmd(command.vx, command.wz, command.brake ?? false, { logSent: false });
  };
  manualSendStopRef.current = () => {
    sendCmd(0, 0, true, { logSent: true, logLabel: "manual release stop" });
  };

  function sendEmergencyStop() {
    stopManualRepeat({ sendStop: false });
    void authorizeAndSend(
      createEmergencyStopPacket({
        missionId,
        roverId,
        seq: nextSeq(),
        reason: "operator",
        schema,
      }),
    );
  }

  function startManualRepeat(command: ManualCommand, label: string) {
    manualRepeaterRef.current?.start(command);
    setManualRepeatRunning(true);
    appendLog(
      "system",
      `Manual repeat: ${label} vx=${command.vx} wz=${command.wz} brake=${command.brake ?? false}`,
    );
  }

  function stopManualRepeat(options: { sendStop: boolean }) {
    if (!manualRepeaterRef.current?.isRunning()) {
      return;
    }

    if (options.sendStop) {
      manualRepeaterRef.current.stopAndSendStop();
    } else {
      manualRepeaterRef.current.cancel();
    }
    setManualRepeatRunning(false);
  }

  function manualPointerHandlers(command: ManualCommand, label: string) {
    return {
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        startManualRepeat(command, label);
      },
      onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
        event.currentTarget.releasePointerCapture(event.pointerId);
        stopManualRepeat({ sendStop: true });
      },
      onPointerLeave: () => stopManualRepeat({ sendStop: true }),
      onPointerCancel: () => stopManualRepeat({ sendStop: true }),
    };
  }

  return (
    <main className="appShell">
      <section className="topBar" aria-label="Rover connection">
        <div>
          <h1>Lv1 Rover Control</h1>
          <p>Mock transport / manual command path</p>
        </div>
        <div className={`statusBadge ${connected ? "online" : "offline"}`}>
          {connected ? "Connected" : "Disconnected"}
        </div>
        <div className="connectionActions">
          <button type="button" onClick={connect} disabled={connected}>
            Connect
          </button>
          <button type="button" onClick={disconnect} disabled={!connected}>
            Disconnect
          </button>
        </div>
      </section>

      <section className="transportPanel" aria-label="Transport mode">
        <label>
          Transport
          <select
            value={transportMode}
            onChange={(event) => {
              void changeTransportMode(event.target.value as TransportMode);
            }}
          >
            <option value="mock">Mock</option>
            <option value="web_bluetooth" disabled={!bluetoothAvailable}>
              Web Bluetooth
            </option>
          </select>
        </label>
        {!bluetoothAvailable && (
          <p className="transportNotice">
            Web Bluetooth is not available in this browser. Use Mock mode.
          </p>
        )}
        {transportMode === "web_bluetooth" && (
          <p className="transportNotice">
            Heartbeat {heartbeatRunning ? "running" : "stopped"}
            {lastHeartbeatAt === null
              ? ""
              : ` / last ${new Date(lastHeartbeatAt).toLocaleTimeString()}`}
          </p>
        )}
        <p className="transportNotice">
          Manual repeat {manualRepeatRunning ? "running" : "stopped"}
        </p>
      </section>

      <section className="identityPanel" aria-label="Rover identity">
        <label>
          Mission ID
          <input value={missionId} onChange={(event) => setMissionId(event.target.value)} />
        </label>
        <label>
          Rover ID
          <input value={roverId} onChange={(event) => setRoverId(event.target.value)} />
        </label>
      </section>

      <section className="manualPanel" aria-label="Manual controls">
        <div className="drivePad" aria-label="Drive pad">
          <button
            type="button"
            className="driveButton forward"
            {...manualPointerHandlers(manualDriveCommands.forward, "forward")}
          >
            Forward
          </button>
          <button
            type="button"
            className="driveButton left"
            {...manualPointerHandlers(manualDriveCommands.left, "left")}
          >
            Left
          </button>
          <button
            type="button"
            className="driveButton stop"
            {...manualPointerHandlers(manualDriveCommands.stop, "stop")}
          >
            Stop
          </button>
          <button
            type="button"
            className="driveButton right"
            {...manualPointerHandlers(manualDriveCommands.right, "right")}
          >
            Right
          </button>
          <button
            type="button"
            className="driveButton back"
            {...manualPointerHandlers(manualDriveCommands.back, "back")}
          >
            Back
          </button>
        </div>

        <div className="safetyControls" aria-label="Safety controls">
          <button
            type="button"
            className="estopButton"
            onClick={sendEmergencyStop}
          >
            E-stop
          </button>
          <button
            type="button"
            className="neutralButton"
            onClick={() =>
              sendCmd(
                manualDriveCommands.neutral.vx,
                manualDriveCommands.neutral.wz,
                manualDriveCommands.neutral.brake,
                { logLabel: "neutral stop sent" },
              )
            }
          >
            Neutral
          </button>
        </div>
      </section>

      <section className="detailsGrid">
        <div className="panel">
          <h2>Last Packet</h2>
          <pre>{lastPacket ? JSON.stringify(lastPacket, null, 2) : "No packet sent yet"}</pre>
        </div>
        <div className="panel">
          <h2>Send Log</h2>
          <ol className="logList">
            {logs.map((entry) => (
              <li key={entry.id} className={entry.status}>
                {entry.message}
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}

function transportLabel(mode: TransportMode): string {
  return mode === "web_bluetooth" ? "Web Bluetooth" : "MockTransport";
}
