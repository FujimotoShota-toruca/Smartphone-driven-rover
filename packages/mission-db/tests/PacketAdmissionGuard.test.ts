import { describe, expect, it } from "vitest";

import { CommandRegistry } from "../src/CommandRegistry";
import { PacketAdmissionGuard } from "../src/PacketAdmissionGuard";
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

const guard = new PacketAdmissionGuard({
  registry,
  schemaHashGuard: new SchemaHashGuard(currentHashes, registry),
});

const packet: RoverPacket = {
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

describe("PacketAdmissionGuard", () => {
  it("admits known cmd_vel when hashes match", () => {
    expect(guard.evaluate(packet)).toEqual({
      admitted: true,
      reason: "hash_matched",
      errors: [],
      envelopeValid: true,
      knownMessage: true,
      knownCommand: true,
      knownTelemetry: false,
      hashMatched: true,
      fixedSafeMessage: false,
    });
  });

  it("rejects an unknown msg_type even when hashes match", () => {
    const result = guard.evaluate({
      ...packet,
      msg_type: "not_defined",
    });

    expect(result.admitted).toBe(false);
    expect(result.reason).toBe("unknown_msg_type");
    expect(result.envelopeValid).toBe(true);
    expect(result.knownMessage).toBe(false);
    expect(result.knownCommand).toBe(false);
    expect(result.knownTelemetry).toBe(false);
    expect(result.hashMatched).toBe(true);
    expect(result.fixedSafeMessage).toBe(false);
  });

  it("rejects cmd_vel when hashes mismatch", () => {
    const result = guard.evaluate({
      ...packet,
      schema: {
        ...packet.schema,
        mission_db_hash: "mission-old",
      },
    });

    expect(result.admitted).toBe(false);
    expect(result.reason).toBe("schema_hash_mismatch");
    expect(result.envelopeValid).toBe(true);
    expect(result.knownMessage).toBe(true);
    expect(result.knownCommand).toBe(true);
    expect(result.knownTelemetry).toBe(false);
    expect(result.hashMatched).toBe(false);
    expect(result.fixedSafeMessage).toBe(false);
  });

  it("rejects telemetry when hashes mismatch", () => {
    const result = guard.evaluate({
      ...packet,
      packet_type: "telemetry",
      msg_type: "pico_hk",
      schema: {
        ...packet.schema,
        board_profile_hash: "board-old",
      },
    });

    expect(result.admitted).toBe(false);
    expect(result.reason).toBe("schema_hash_mismatch");
    expect(result.knownMessage).toBe(true);
    expect(result.knownCommand).toBe(false);
    expect(result.knownTelemetry).toBe(true);
    expect(result.hashMatched).toBe(false);
  });

  it.each(["emergency_stop", "heartbeat"])(
    "admits fixed safe message %s when hashes mismatch",
    (msgType) => {
      const result = guard.evaluate({
        ...packet,
        msg_type: msgType,
        schema: {
          ...packet.schema,
          mission_db_hash: "mission-old",
        },
      });

      expect(result.admitted).toBe(true);
      expect(result.reason).toBe(
        "fixed_safe_message_hash_mismatch_allowed",
      );
      expect(result.envelopeValid).toBe(true);
      expect(result.knownMessage).toBe(true);
      expect(result.knownCommand).toBe(false);
      expect(result.knownTelemetry).toBe(false);
      expect(result.hashMatched).toBe(false);
      expect(result.fixedSafeMessage).toBe(true);
    },
  );

  it("rejects an invalid emergency_stop envelope", () => {
    const { ttl_ms: _ttlMs, ...invalidPacket } = {
      ...packet,
      msg_type: "emergency_stop",
      schema: {
        ...packet.schema,
        mission_db_hash: "mission-old",
      },
    };

    const result = guard.evaluate(invalidPacket);

    expect(result.admitted).toBe(false);
    expect(result.reason).toBe("invalid_envelope");
    expect(result.envelopeValid).toBe(false);
    expect(result.knownMessage).toBe(false);
    expect(result.hashMatched).toBe(false);
    expect(result.fixedSafeMessage).toBe(true);
    expect(result.errors.some((error) => error.includes("ttl_ms"))).toBe(true);
  });
});
