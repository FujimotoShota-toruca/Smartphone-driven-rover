import { describe, expect, it } from "vitest";

import { PacketEnvelopeValidator } from "../src/PacketEnvelopeValidator";
import { PACKET_NUMERIC_LIMITS } from "../src/numericLimits";
import type { RoverPacket } from "../src/types";
import { FIXED_SAFE_MESSAGE_TYPES } from "../src/validation";

const validPacket: RoverPacket = {
  protocol_version: 1,
  mission_id: "engineering_rover_demo",
  rover_id: "rover_01",
  packet_type: "command",
  msg_type: "cmd_vel",
  seq: 1024,
  timestamp_ms: 12_345_678,
  ttl_ms: 300,
  schema: {
    core_protocol_hash: "core-abc",
    mission_db_hash: "mission-def",
    board_profile_hash: "board-ghi",
  },
  payload: {
    vx: 0.25,
    wz: -0.5,
  },
};

describe("PacketEnvelopeValidator", () => {
  const validator = new PacketEnvelopeValidator();

  it("accepts a valid RoverPacket", () => {
    expect(validator.validate(validPacket)).toEqual({
      valid: true,
      errors: [],
      isFixedSafeMessage: false,
    });
    expect(validator.isValid(validPacket)).toBe(true);
  });

  it.each([
    "protocol_version",
    "mission_id",
    "rover_id",
    "packet_type",
    "msg_type",
    "seq",
    "timestamp_ms",
    "ttl_ms",
    "schema",
    "payload",
  ])("rejects a packet missing required field %s", (field) => {
    const packet = { ...validPacket } as Record<string, unknown>;
    delete packet[field];

    const result = validator.validate(packet);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: field, code: "required" }),
    );
  });

  it.each(["protocol_version", "seq", "timestamp_ms", "ttl_ms"])(
    "rejects invalid values for numeric field %s",
    (field) => {
      for (const invalidValue of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
        const packet = { ...validPacket, [field]: invalidValue };
        const result = validator.validate(packet);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({ path: field, code: "invalid_value" }),
        );
      }
    },
  );

  it("rejects seq values greater than uint32 max", () => {
    const result = validator.validate({
      ...validPacket,
      seq: PACKET_NUMERIC_LIMITS.seq + 1,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: "seq", code: "invalid_value" }),
    );
  });

  it("rejects protocol_version values greater than uint8 max", () => {
    const result = validator.validate({
      ...validPacket,
      protocol_version: PACKET_NUMERIC_LIMITS.protocol_version + 1,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        path: "protocol_version",
        code: "invalid_value",
      }),
    );
  });

  it.each([
    "mission_id",
    "rover_id",
    "packet_type",
    "msg_type",
  ])("rejects an empty string for %s", (field) => {
    const result = validator.validate({ ...validPacket, [field]: "" });

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: field, code: "invalid_value" }),
    );
  });

  it.each([
    "core_protocol_hash",
    "mission_db_hash",
    "board_profile_hash",
  ])("rejects a missing schema hash field %s", (field) => {
    const schema = { ...validPacket.schema } as Record<string, unknown>;
    delete schema[field];

    const result = validator.validate({ ...validPacket, schema });

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: `schema.${field}`, code: "required" }),
    );
  });

  it.each([
    "core_protocol_hash",
    "mission_db_hash",
    "board_profile_hash",
  ])("rejects an empty schema hash field %s", (field) => {
    const result = validator.validate({
      ...validPacket,
      schema: { ...validPacket.schema, [field]: "" },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        path: `schema.${field}`,
        code: "invalid_value",
      }),
    );
  });

  it.each([undefined, null, [], "payload", 1, true])(
    "rejects a non-object payload: %j",
    (payload) => {
      const result = validator.validate({ ...validPacket, payload });

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ path: "payload", code: "invalid_type" }),
      );
    },
  );

  it("rejects an undefined schema", () => {
    const result = validator.validate({ ...validPacket, schema: undefined });

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: "schema", code: "invalid_type" }),
    );
  });

  it.each(FIXED_SAFE_MESSAGE_TYPES)(
    "identifies %s as a fixed safe message",
    (msgType) => {
      const result = validator.validate({ ...validPacket, msg_type: msgType });

      expect(result.valid).toBe(true);
      expect(result.isFixedSafeMessage).toBe(true);
    },
  );

  it("does not identify cmd_vel as a fixed safe message", () => {
    const result = validator.validate(validPacket);

    expect(result.isFixedSafeMessage).toBe(false);
  });

  it("keeps valid false when emergency_stop packet envelope is invalid", () => {
    const result = validator.validate({
      ...validPacket,
      msg_type: "emergency_stop",
      seq: -1,
    });

    expect(result.valid).toBe(false);
    expect(result.isFixedSafeMessage).toBe(true);
  });

  it("does not check fixed safe messages unless msg_type is a string", () => {
    const result = validator.validate({
      ...validPacket,
      msg_type: { value: "emergency_stop" },
    });

    expect(result.valid).toBe(false);
    expect(result.isFixedSafeMessage).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: "msg_type", code: "invalid_value" }),
    );
  });
});
