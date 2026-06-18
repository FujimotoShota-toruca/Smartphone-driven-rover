import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { CommandAuthorizationPipeline } from "../src/CommandAuthorizationPipeline";
import { CommandRegistry } from "../src/CommandRegistry";
import { hashMissionDb } from "../src/hashMissionDb";
import { loadMissionDb } from "../src/loadMissionDb";
import type {
  BoardProfileDefinition,
  MissionDb,
  MissionDbHashes,
  MissionProfileDefinition,
} from "../src/types";
import type { RoverPacket } from "../../protocol/src/types";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

interface Fixture {
  missionDb: MissionDb;
  hashes: MissionDbHashes;
  registry: CommandRegistry;
  engineering: MissionProfileDefinition;
  tanegashima: MissionProfileDefinition;
  minimalBoard: BoardProfileDefinition;
  tanegashimaBoard: BoardProfileDefinition;
}

async function loadFixture(): Promise<Fixture> {
  const missionDb = await loadMissionDb(repoRoot);
  return {
    missionDb,
    hashes: hashMissionDb(missionDb),
    registry: CommandRegistry.fromMissionDb(missionDb),
    engineering: getMissionProfile(missionDb, "engineering_rover_demo"),
    tanegashima: getMissionProfile(missionDb, "tanegashima_auto_control"),
    minimalBoard: getBoardProfile(missionDb, "minimal_2wheel_pico_board"),
    tanegashimaBoard: getBoardProfile(missionDb, "tanegashima_rover_board"),
  };
}

function makeCmdVelPacket(hashes: MissionDbHashes): RoverPacket {
  return {
    protocol_version: 1,
    mission_id: "engineering_rover_demo",
    rover_id: "rover_01",
    packet_type: "command",
    msg_type: "cmd_vel",
    seq: 1,
    timestamp_ms: 100,
    ttl_ms: 300,
    schema: hashes,
    payload: {
      vx: 0.25,
      wz: 1.0,
    },
  };
}

describe("CommandAuthorizationPipeline", () => {
  it("authorizes valid local_phone cmd_vel in engineering profile", async () => {
    const fixture = await loadFixture();
    const pipeline = new CommandAuthorizationPipeline();

    const result = pipeline.evaluate({
      packet: makeCmdVelPacket(fixture.hashes),
      missionProfile: fixture.engineering,
      boardProfile: fixture.minimalBoard,
      safetyPolicy: fixture.missionDb.safety,
      currentHashes: fixture.hashes,
      registry: fixture.registry,
      origin: "local_phone",
      mode: "MANUAL",
    });

    expect(result).toEqual({
      authorized: true,
      reason: "authorized",
      errors: [],
      stage: "authorized",
      packetAdmitted: true,
      missionAllowed: true,
      safetyAllowed: true,
      boardAllowed: true,
      fixedSafeMessage: false,
    });
  });

  it("rejects remote_ground cmd_vel in Tanegashima profile", async () => {
    const fixture = await loadFixture();
    const pipeline = new CommandAuthorizationPipeline();

    const result = pipeline.evaluate({
      packet: makeCmdVelPacket(fixture.hashes),
      missionProfile: fixture.tanegashima,
      boardProfile: fixture.tanegashimaBoard,
      safetyPolicy: fixture.missionDb.safety,
      currentHashes: fixture.hashes,
      registry: fixture.registry,
      origin: "remote_ground",
      mode: "MANUAL",
    });

    expect(result.authorized).toBe(false);
    expect(result.stage).toBe("mission_profile");
    expect(result.packetAdmitted).toBe(true);
    expect(result.missionAllowed).toBe(false);
    expect(result.errors).toContain(
      "remote uplink is not allowed by mission profile",
    );
  });

  it("rejects hash-mismatched cmd_vel at packet_admission stage", async () => {
    const fixture = await loadFixture();
    const pipeline = new CommandAuthorizationPipeline();
    const packet = makeCmdVelPacket({
      ...fixture.hashes,
      mission_db_hash: "mission-old",
    });

    const result = pipeline.evaluate({
      packet,
      missionProfile: fixture.engineering,
      boardProfile: fixture.minimalBoard,
      safetyPolicy: fixture.missionDb.safety,
      currentHashes: fixture.hashes,
      registry: fixture.registry,
      origin: "local_phone",
      mode: "MANUAL",
    });

    expect(result.authorized).toBe(false);
    expect(result.stage).toBe("packet_admission");
    expect(result.reason).toBe("schema_hash_mismatch");
    expect(result.packetAdmitted).toBe(false);
  });

  it("rejects unknown msg_type", async () => {
    const fixture = await loadFixture();
    const pipeline = new CommandAuthorizationPipeline();
    const packet = {
      ...makeCmdVelPacket(fixture.hashes),
      msg_type: "unknown_command",
    };

    const result = pipeline.evaluate({
      packet,
      missionProfile: fixture.engineering,
      boardProfile: fixture.minimalBoard,
      safetyPolicy: fixture.missionDb.safety,
      currentHashes: fixture.hashes,
      registry: fixture.registry,
      origin: "local_phone",
      mode: "MANUAL",
    });

    expect(result.authorized).toBe(false);
    expect(result.stage).toBe("packet_admission");
    expect(result.reason).toBe("unknown_msg_type");
  });

  it("rejects max_vx-exceeding cmd_vel at safety_policy stage", async () => {
    const fixture = await loadFixture();
    const pipeline = new CommandAuthorizationPipeline();
    const packet = {
      ...makeCmdVelPacket(fixture.hashes),
      payload: { vx: 0.75, wz: 1.0 },
    };

    const result = pipeline.evaluate({
      packet,
      missionProfile: fixture.engineering,
      boardProfile: fixture.minimalBoard,
      safetyPolicy: fixture.missionDb.safety,
      currentHashes: fixture.hashes,
      registry: fixture.registry,
      origin: "local_phone",
      mode: "MANUAL",
    });

    expect(result.authorized).toBe(false);
    expect(result.stage).toBe("safety_policy");
    expect(result.safetyAllowed).toBe(false);
    expect(result.errors).toContain("payload.vx exceeds max_vx");
  });

  it("rejects cmd_vel at board_profile stage when drive_control is missing", async () => {
    const fixture = await loadFixture();
    const pipeline = new CommandAuthorizationPipeline();

    const result = pipeline.evaluate({
      packet: makeCmdVelPacket(fixture.hashes),
      missionProfile: fixture.engineering,
      boardProfile: {
        schema_version: 1,
        board_profile: {
          name: "sensor_only_board",
          capabilities: {
            local_telemetry: true,
          },
        },
      },
      safetyPolicy: fixture.missionDb.safety,
      currentHashes: fixture.hashes,
      registry: fixture.registry,
      origin: "local_phone",
      mode: "MANUAL",
    });

    expect(result.authorized).toBe(false);
    expect(result.stage).toBe("board_profile");
    expect(result.boardAllowed).toBe(false);
    expect(result.errors).toContain("required capability is missing: drive_control");
  });

  it("authorizes emergency_stop even when schema hash mismatches", async () => {
    const fixture = await loadFixture();
    const pipeline = new CommandAuthorizationPipeline();
    const packet = {
      ...makeCmdVelPacket({
        ...fixture.hashes,
        mission_db_hash: "mission-old",
      }),
      msg_type: "emergency_stop",
      payload: { reason: "operator" },
    };

    const result = pipeline.evaluate({
      packet,
      missionProfile: fixture.tanegashima,
      boardProfile: fixture.minimalBoard,
      safetyPolicy: fixture.missionDb.safety,
      currentHashes: fixture.hashes,
      registry: fixture.registry,
      origin: "remote_ground",
      mode: "GNSS_GUIDANCE",
    });

    expect(result).toMatchObject({
      authorized: true,
      reason: "fixed_safe_message_authorized",
      stage: "authorized",
      packetAdmitted: true,
      missionAllowed: true,
      safetyAllowed: true,
      boardAllowed: true,
      fixedSafeMessage: true,
    });
  });

  it("rejects invalid emergency_stop envelope", async () => {
    const fixture = await loadFixture();
    const pipeline = new CommandAuthorizationPipeline();
    const { ttl_ms: _ttlMs, ...packet } = {
      ...makeCmdVelPacket(fixture.hashes),
      msg_type: "emergency_stop",
    };

    const result = pipeline.evaluate({
      packet,
      missionProfile: fixture.engineering,
      boardProfile: fixture.minimalBoard,
      safetyPolicy: fixture.missionDb.safety,
      currentHashes: fixture.hashes,
      registry: fixture.registry,
      origin: "local_phone",
      mode: "MANUAL",
    });

    expect(result.authorized).toBe(false);
    expect(result.stage).toBe("packet_admission");
    expect(result.reason).toBe("invalid_envelope");
    expect(result.fixedSafeMessage).toBe(true);
  });
});

function getMissionProfile(
  missionDb: MissionDb,
  name: string,
): MissionProfileDefinition {
  const profile = missionDb.missionProfiles.find(
    (item) => item.mission_profile.name === name,
  );
  if (!profile) {
    throw new Error(`missing mission profile ${name}`);
  }
  return profile;
}

function getBoardProfile(missionDb: MissionDb, name: string): BoardProfileDefinition {
  const profile = missionDb.boardProfiles.find(
    (item) => item.board_profile.name === name,
  );
  if (!profile) {
    throw new Error(`missing board profile ${name}`);
  }
  return profile;
}
