import { useMemo, useRef, useState } from "react";
import type { RoverPacket } from "@smartphone-rover/protocol";
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

import { createCmdVelPacket } from "./packet/createCmdVelPacket";
import { createEmergencyStopPacket } from "./packet/createEmergencyStopPacket";
import { MockRoverTransport } from "./transport/MockRoverTransport";

interface LogEntry {
  id: number;
  status: "sent" | "rejected" | "system";
  message: string;
}

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
    max_vx: 0.5,
    max_wz: 2.0,
    cmd_vel_default_ttl_ms: 300,
    release_allowed_modes: ["MANUAL"],
  },
};

const registry = new CommandRegistry({
  commands: ["cmd_vel"],
  telemetry: ["pico_hk"],
});

export function App() {
  const transportRef = useRef(new MockRoverTransport());
  const seqRef = useRef(1);
  const [missionId, setMissionId] = useState("engineering_rover_demo");
  const [roverId, setRoverId] = useState("rover_01");
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastPacket, setLastPacket] = useState<RoverPacket | null>(null);

  const pipeline = useMemo(() => new CommandAuthorizationPipeline(), []);

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
    appendLog("system", "MockTransport connected");
  }

  async function disconnect() {
    await transportRef.current.disconnect();
    setConnected(false);
    appendLog("system", "MockTransport disconnected");
  }

  async function authorizeAndSend(packet: RoverPacket) {
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
      return;
    }

    try {
      await transportRef.current.send(packet);
      setLastPacket(packet);
      appendLog("sent", `${packet.msg_type} sent seq=${packet.seq}`);
    } catch (error) {
      appendLog("rejected", error instanceof Error ? error.message : String(error));
    }
  }

  function nextSeq() {
    const seq = seqRef.current;
    seqRef.current += 1;
    return seq;
  }

  function sendCmd(vx: number, wz: number, brake = false) {
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
    );
  }

  function sendEmergencyStop() {
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

      <section className="controlGrid" aria-label="Manual controls">
        <button type="button" className="driveButton" onClick={() => sendCmd(0.3, 0)}>
          Forward
        </button>
        <button type="button" className="driveButton" onClick={() => sendCmd(0, -1)}>
          Left
        </button>
        <button type="button" className="driveButton stop" onClick={() => sendCmd(0, 0, true)}>
          Stop
        </button>
        <button type="button" className="driveButton" onClick={() => sendCmd(0, 1)}>
          Right
        </button>
        <button type="button" className="driveButton" onClick={() => sendCmd(-0.3, 0)}>
          Back
        </button>
        <button type="button" className="driveButton neutral" onClick={() => sendCmd(0, 0)}>
          Neutral
        </button>
        <button type="button" className="estopButton" onClick={sendEmergencyStop}>
          E-stop
        </button>
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
