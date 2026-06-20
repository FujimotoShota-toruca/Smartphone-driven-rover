import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  DEFAULT_MANUAL_PWM_PERCENT,
  createManualDriveCommand,
  defaultManualButtonAssignments,
  manualDriveCommands,
  manualDriveCommandCodes,
  manualDriveDirections,
  manualPwmToCompatCmdVel,
  type ManualDriveDirection,
  type ManualPwmCommand,
} from "./manual/manualDriveCommands";
import { createCmdVelPacket } from "./packet/createCmdVelPacket";
import { createEmergencyStopPacket } from "./packet/createEmergencyStopPacket";
import { createHeartbeatPacket } from "./packet/createHeartbeatPacket";
import { createResetEstopPacket } from "./packet/createResetEstopPacket";
import { parseTelemetryMessage, type AckRejectTelemetry, type SafetyStateTelemetry } from "./telemetry/TelemetryMessage";
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
export function App() {
  const transportRef = useRef<RoverTransport>(new MockRoverTransport());
  const heartbeatInFlightRef = useRef(false);
  const seqRef = useRef(1);
  const bluetoothAvailable = useMemo(() => isWebBluetoothAvailable(), []);
  const [transportMode, setTransportMode] = useState<TransportMode>("mock");
  const [missionId, setMissionId] = useState("engineering_rover_demo");
  const [roverId, setRoverId] = useState("rover_01");
  const [connected, setConnected] = useState(false);
  const [heartbeatRunning, setHeartbeatRunning] = useState(false);
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState<number | null>(null);
  const [activeManualCommand, setActiveManualCommand] = useState("none");
  const [lastManualCommandAt, setLastManualCommandAt] = useState<number | null>(null);
  const [leftPwmPercent, setLeftPwmPercent] = useState(DEFAULT_MANUAL_PWM_PERCENT);
  const [rightPwmPercent, setRightPwmPercent] = useState(DEFAULT_MANUAL_PWM_PERCENT);
  const [buttonAssignments, setButtonAssignments] = useState(defaultManualButtonAssignments);
  const [lastAckReject, setLastAckReject] = useState<AckRejectTelemetry | null>(null);
  const [safetyState, setSafetyState] = useState<SafetyStateTelemetry | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastPacket, setLastPacket] = useState<RoverPacket | null>(null);

  const pipeline = useMemo(() => new CommandAuthorizationPipeline(), []);

  useEffect(() => {
    transportRef.current.setTelemetryHandler?.(handleTelemetryMessage);
    return () => {
      transportRef.current.setTelemetryHandler?.(null);
    };
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
      await transportRef.current.disconnect();
      setConnected(false);
      heartbeatInFlightRef.current = false;
    }

    transportRef.current =
      mode === "web_bluetooth" ? new WebBluetoothTransport() : new MockRoverTransport();
    transportRef.current.setTelemetryHandler?.(handleTelemetryMessage);
    setTransportMode(mode);
    appendLog("system", `Transport mode: ${transportLabel(mode)}`);
  }

  function handleTelemetryMessage(messageText: string) {
    try {
      const message = parseTelemetryMessage(messageText);
      if (message.msg_type === "ack" || message.msg_type === "reject") {
        setLastAckReject(message);
        appendLog(
          message.accepted ? "sent" : "rejected",
          `Pico ${message.msg_type} seq=${message.seq} reason=${message.reason}`,
        );
        return;
      }

      if (message.msg_type === "safety_state") {
        setSafetyState(message);
      }
    } catch (error) {
      appendLog(
        "rejected",
        `telemetry parse error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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

  async function sendManualPwmCommand(
    command: ManualPwmCommand,
    label: string,
  ): Promise<boolean> {
    setLastManualCommandAt(Date.now());
    setActiveManualCommand(label);
    const compat = manualPwmToCompatCmdVel(command);
    return authorizeAndSend(
      createCmdVelPacket({
        missionId,
        roverId,
        seq: nextSeq(),
        vx: compat.vx,
        wz: compat.wz,
        brake: command.brake,
        mode: "manual_pwm",
        leftPwm: command.leftPwm,
        rightPwm: command.rightPwm,
        coast: command.coast,
        ttlMs: 300,
        schema,
      }),
      {
        logLabel:
          command.coast
            ? "manual neutral coast"
            : command.brake
              ? "manual stop brake"
              : `manual pwm drive left=${command.leftPwm.toFixed(2)} right=${command.rightPwm.toFixed(2)}`,
      },
    );
  }

  function sendEmergencyStop() {
    setActiveManualCommand("none");
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

  async function sendResetEstop() {
    setActiveManualCommand("none");
    const packet = createResetEstopPacket({
      missionId,
      roverId,
      seq: nextSeq(),
      reason: "operator_reset",
      schema,
    });

    try {
      await transportRef.current.send(packet);
      setLastPacket(packet);
      appendLog("sent", `reset_estop sent seq=${packet.seq}`);
    } catch (error) {
      appendLog("rejected", error instanceof Error ? error.message : String(error));
    }
  }

  function sendExplicitStop() {
    void sendManualPwmCommand(manualDriveCommands.stop, "stop");
  }

  function sendNeutralCoast() {
    void sendManualPwmCommand(manualDriveCommands.neutral, "neutral");
  }

  function sendManualDirection(button: ManualDriveDirection) {
    const direction = buttonAssignments[button];
    void sendManualPwmCommand(
      createManualDriveCommand(direction, leftPwmPercent, rightPwmPercent),
      button === direction ? direction : `${button}->${direction}`,
    );
  }

  function changeButtonAssignment(button: ManualDriveDirection, direction: ManualDriveDirection) {
    setButtonAssignments((current) => ({
      ...current,
      [button]: direction,
    }));
    appendLog("system", `${capitalizeDirection(button)} button sends ${capitalizeDirection(direction)}`);
  }

  const estopLatched = safetyState?.estop === "latched";

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
          Active manual command={activeManualCommand}
          {lastManualCommandAt === null
            ? ""
            : ` / last ${new Date(lastManualCommandAt).toLocaleTimeString()}`}
        </p>
        <p className="transportNotice">
          Pico safety estop={safetyState?.estop ?? "unknown"} heartbeat=
          {safetyState?.heartbeat ?? "unknown"} safety_stop=
          {safetyState ? String(safetyState.safety_stop) : "unknown"}
        </p>
        <p className="transportNotice">
          Pico active mode={safetyState?.active_mode ?? "unknown"} left=
          {safetyState?.left_pwm?.toFixed(2) ?? "unknown"} right=
          {safetyState?.right_pwm?.toFixed(2) ?? "unknown"}
        </p>
        <p className="transportNotice">
          Last ack/reject{" "}
          {lastAckReject
            ? `${lastAckReject.msg_type} seq=${lastAckReject.seq} reason=${lastAckReject.reason}`
            : "none"}
        </p>
        <p className="transportNotice">
          Last safety timestamp {safetyState ? `${safetyState.now_ms} ms` : "none"}
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
        <div className="pwmPanel" aria-label="Manual PWM controls">
          <label>
            Left output {leftPwmPercent}%
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={leftPwmPercent}
              onChange={(event) => setLeftPwmPercent(Number(event.target.value))}
            />
          </label>
          <label>
            Right output {rightPwmPercent}%
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={rightPwmPercent}
              onChange={(event) => setRightPwmPercent(Number(event.target.value))}
            />
          </label>
        </div>

        <div className="drivePad" aria-label="Drive pad">
          <button
            type="button"
            className="driveButton forward"
            onClick={() => sendManualDirection("forward")}
          >
            Forward
          </button>
          <button
            type="button"
            className="driveButton left"
            onClick={() => sendManualDirection("left")}
          >
            Left
          </button>
          <button
            type="button"
            className="driveButton stop"
            onClick={sendExplicitStop}
          >
            Stop
          </button>
          <button
            type="button"
            className="driveButton right"
            onClick={() => sendManualDirection("right")}
          >
            Right
          </button>
          <button
            type="button"
            className="driveButton back"
            onClick={() => sendManualDirection("back")}
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
            className="resetEstopButton"
            onClick={() => void sendResetEstop()}
            disabled={!estopLatched}
          >
            Reset E-stop
          </button>
          <button
            type="button"
            className="neutralButton"
            onClick={sendNeutralCoast}
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

      <details className="assignmentPanel">
        <summary>Command assignment</summary>
        <div className="assignmentGrid" aria-label="Manual button assignments">
          {manualDriveDirections.map((button) => (
            <label key={button}>
              {capitalizeDirection(button)} button
              <select
                value={buttonAssignments[button]}
                onChange={(event) =>
                  changeButtonAssignment(button, event.target.value as ManualDriveDirection)
                }
              >
                {manualDriveDirections.map((direction) => (
                  <option key={direction} value={direction}>
                    {manualDriveCommandCodes[direction]}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </details>
    </main>
  );
}

function transportLabel(mode: TransportMode): string {
  return mode === "web_bluetooth" ? "Web Bluetooth" : "MockTransport";
}

function capitalizeDirection(direction: ManualDriveDirection): string {
  return direction.charAt(0).toUpperCase() + direction.slice(1);
}
