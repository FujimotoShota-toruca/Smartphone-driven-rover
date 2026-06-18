import { describe, expect, it } from "vitest";

import { CommandRegistry } from "../src/CommandRegistry";
import { SchemaHashGuard } from "../src/SchemaHashGuard";
import type { MissionDbHashes } from "../src/types";
import type { RoverPacket } from "../../protocol/src/types";

const currentHashes: MissionDbHashes = {
  core_protocol_hash: "core-current",
  mission_db_hash: "mission-current",
  board_profile_hash: "board-current",
};

const registry = new CommandRegistry({
  commands: ["cmd_vel"],
  telemetry: ["pico_hk"],
});

const basePacket: RoverPacket = {
  protocol_version: 1,
  mission_id: "engineering_rover_demo",
  rover_id: "rover_01",
  packet_type: "command",
  msg_type: "cmd_vel",
  seq: 1,
  timestamp_ms: 1000,
  ttl_ms: 300,
  schema: currentHashes,
  payload: {},
};

describe("SchemaHashGuard", () => {
  it("allows a known normal command when all hashes match", () => {
    const guard = new SchemaHashGuard(currentHashes, registry);

    expect(guard.evaluate(basePacket)).toEqual({
      allowed: true,
      reason: "hash_matched",
      errors: [],
      hashMatched: true,
      fixedSafeMessage: false,
      knownMessage: true,
    });
  });

  it("rejects a known normal command when a hash mismatches", () => {
    const guard = new SchemaHashGuard(currentHashes, registry);
    const result = guard.evaluate({
      ...basePacket,
      schema: {
        ...basePacket.schema,
        mission_db_hash: "mission-old",
      },
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("schema_hash_mismatch");
    expect(result.hashMatched).toBe(false);
    expect(result.fixedSafeMessage).toBe(false);
    expect(result.knownMessage).toBe(true);
    expect(result.errors).toContain("mission_db_hash mismatch");
  });

  it.each(["emergency_stop", "heartbeat", "read_schema_info"])(
    "allows fixed safe message %s when hashes mismatch",
    (msgType) => {
      const guard = new SchemaHashGuard(currentHashes, registry);
      const result = guard.evaluate({
        ...basePacket,
        msg_type: msgType,
        schema: {
          ...basePacket.schema,
          mission_db_hash: "mission-old",
        },
      });

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("fixed_safe_message_hash_mismatch_allowed");
      expect(result.hashMatched).toBe(false);
      expect(result.fixedSafeMessage).toBe(true);
      expect(result.knownMessage).toBe(true);
    },
  );

  it("rejects an unknown msg_type even when hashes match", () => {
    const guard = new SchemaHashGuard(currentHashes, registry);
    const result = guard.evaluate({
      ...basePacket,
      msg_type: "not_defined",
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("unknown_msg_type");
    expect(result.hashMatched).toBe(true);
    expect(result.fixedSafeMessage).toBe(false);
    expect(result.knownMessage).toBe(false);
  });
});
