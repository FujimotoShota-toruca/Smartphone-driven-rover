import { CodecError, type PacketCodec } from "./PacketCodec";
import type { PacketSchema, RoverPacket } from "./types";

const UINT8_MAX = 0xff;
const UINT32_MAX = 0xffffffff;

export class JsonPacketCodec implements PacketCodec {
  readonly #encoder = new TextEncoder();
  readonly #decoder = new TextDecoder("utf-8", { fatal: true });

  public encode(packet: RoverPacket): Uint8Array {
    assertRoverPacket(packet);

    try {
      return this.#encoder.encode(JSON.stringify(packet));
    } catch (error) {
      throw new CodecError("Failed to encode RoverPacket as JSON", {
        cause: error,
      });
    }
  }

  public decode(data: Uint8Array): RoverPacket {
    let json: string;
    let value: unknown;

    try {
      json = this.#decoder.decode(data);
      value = JSON.parse(json);
    } catch (error) {
      throw new CodecError("Failed to decode RoverPacket JSON", {
        cause: error,
      });
    }

    assertRoverPacket(value);
    return value;
  }
}

function assertRoverPacket(value: unknown): asserts value is RoverPacket {
  assertRecord(value, "packet");

  assertUnsignedInteger(value.protocol_version, "protocol_version", UINT8_MAX);
  assertNonEmptyString(value.mission_id, "mission_id");
  assertNonEmptyString(value.rover_id, "rover_id");
  assertNonEmptyString(value.packet_type, "packet_type");
  assertNonEmptyString(value.msg_type, "msg_type");
  assertUnsignedInteger(value.seq, "seq", UINT32_MAX);
  assertUnsignedInteger(
    value.timestamp_ms,
    "timestamp_ms",
    Number.MAX_SAFE_INTEGER,
  );
  assertUnsignedInteger(value.ttl_ms, "ttl_ms", UINT32_MAX);
  assertPacketSchema(value.schema);
  assertRecord(value.payload, "payload");
}

function assertPacketSchema(value: unknown): asserts value is PacketSchema {
  assertRecord(value, "schema");
  assertNonEmptyString(value.core_protocol_hash, "schema.core_protocol_hash");
  assertNonEmptyString(value.mission_db_hash, "schema.mission_db_hash");
  assertNonEmptyString(value.board_profile_hash, "schema.board_profile_hash");
}

function assertRecord(
  value: unknown,
  fieldName: string,
): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new CodecError(`${fieldName} must be an object`);
  }
}

function assertNonEmptyString(
  value: unknown,
  fieldName: string,
): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new CodecError(`${fieldName} must be a non-empty string`);
  }
}

function assertUnsignedInteger(
  value: unknown,
  fieldName: string,
  maximum: number,
): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > maximum
  ) {
    throw new CodecError(
      `${fieldName} must be an unsigned integer no greater than ${maximum}`,
    );
  }
}
