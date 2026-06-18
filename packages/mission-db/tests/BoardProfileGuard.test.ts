import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { BoardProfileGuard } from "../src/BoardProfileGuard";
import { loadBoardProfiles } from "../src/loadMissionDb";
import type { BoardProfile } from "../src/types";
import type { RoverPacket } from "../../protocol/src/types";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

async function loadBoard(name: string) {
  const boards = await loadBoardProfiles(path.join(repoRoot, "mission", "boards"));
  const board = boards.find((item) => item.board_profile.name === name);
  if (!board) {
    throw new Error(`missing board ${name}`);
  }
  return board;
}

const packet: RoverPacket = {
  protocol_version: 1,
  mission_id: "engineering_rover_demo",
  rover_id: "rover_01",
  packet_type: "command",
  msg_type: "cmd_vel",
  seq: 1,
  timestamp_ms: 100,
  ttl_ms: 300,
  schema: {
    core_protocol_hash: "core",
    mission_db_hash: "mission",
    board_profile_hash: "board",
  },
  payload: {},
};

describe("BoardProfileGuard", () => {
  it("allows cmd_vel when drive_control capability exists", async () => {
    const board = await loadBoard("minimal_2wheel_pico_board");
    const guard = new BoardProfileGuard(board);

    expect(guard.evaluate({ msgType: "cmd_vel" })).toEqual({
      allowed: true,
      reason: "board_capability_available",
      errors: [],
      fixedSafeMessage: false,
      requiredCapability: "drive_control",
      capabilityAvailable: true,
    });
  });

  it("rejects cmd_vel when drive_control capability is missing", () => {
    const board: BoardProfile = {
      name: "sensor_only_board",
      capabilities: {
        local_telemetry: true,
      },
    };
    const guard = new BoardProfileGuard(board);
    const result = guard.evaluate({ msgType: "cmd_vel" });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("board_capability_missing");
    expect(result.requiredCapability).toBe("drive_control");
    expect(result.capabilityAvailable).toBe(false);
  });

  it("allows fire_nichrome when release_mechanism capability exists", async () => {
    const board = await loadBoard("tanegashima_rover_board");
    const guard = new BoardProfileGuard(board);
    const result = guard.evaluate({ msgType: "fire_nichrome", mode: "MANUAL" });

    expect(result.allowed).toBe(true);
    expect(result.requiredCapability).toBe("release_mechanism");
    expect(result.capabilityAvailable).toBe(true);
  });

  it("rejects fire_nichrome when release_mechanism capability is missing", async () => {
    const board = await loadBoard("minimal_2wheel_pico_board");
    const guard = new BoardProfileGuard(board);
    const result = guard.evaluate({ msgType: "fire_nichrome", mode: "MANUAL" });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("board_capability_missing");
    expect(result.requiredCapability).toBe("release_mechanism");
  });

  it("allows emergency_stop regardless of board capabilities", () => {
    const guard = new BoardProfileGuard({
      name: "empty_board",
      capabilities: {},
    });

    expect(guard.evaluate({ msgType: "emergency_stop" })).toEqual({
      allowed: true,
      reason: "fixed_safe_message_allowed",
      errors: [],
      fixedSafeMessage: true,
      requiredCapability: null,
      capabilityAvailable: true,
    });
  });

  it("allows basic pico_hk telemetry when local telemetry exists", async () => {
    const board = await loadBoard("minimal_2wheel_pico_board");
    const guard = new BoardProfileGuard(board);
    const result = guard.evaluate({ msgType: "pico_hk" });

    expect(result.allowed).toBe(true);
    expect(result.requiredCapability).toBe("local_telemetry");
  });

  it("rejects unsupported normal commands", async () => {
    const board = await loadBoard("minimal_2wheel_pico_board");
    const guard = new BoardProfileGuard(board);
    const result = guard.evaluate({
      packet: {
        ...packet,
        msg_type: "reset_estop",
      },
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("unsupported_command");
    expect(result.requiredCapability).toBeNull();
  });
});
