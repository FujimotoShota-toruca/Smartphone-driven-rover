import type { RoverPacket } from "./types";
import {
  PACKET_NUMERIC_LIMITS,
  type PacketNumericField,
} from "./numericLimits";
import {
  isFixedSafeMessage,
  type ValidationError,
  type ValidationResult,
} from "./validation";

const requiredFields = [
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
] as const;

const requiredSchemaFields = [
  "core_protocol_hash",
  "mission_db_hash",
  "board_profile_hash",
] as const;

export class PacketEnvelopeValidator {
  public validate(packet: unknown): ValidationResult {
    const errors: ValidationError[] = [];

    if (!isRecord(packet)) {
      return {
        valid: false,
        errors: [
          {
            path: "packet",
            code: "invalid_type",
            message: "packet must be an object",
          },
        ],
        isFixedSafeMessage: false,
      };
    }

    for (const field of requiredFields) {
      requireField(packet, field, errors);
    }

    validateNonNegativeInteger(packet, "protocol_version", errors);
    validateNonNegativeInteger(packet, "seq", errors);
    validateNonNegativeInteger(packet, "timestamp_ms", errors);
    validateNonNegativeInteger(packet, "ttl_ms", errors);

    validateNonEmptyString(packet, "mission_id", errors);
    validateNonEmptyString(packet, "rover_id", errors);
    validateNonEmptyString(packet, "packet_type", errors);
    validateNonEmptyString(packet, "msg_type", errors);

    if (hasOwn(packet, "schema")) {
      validateSchema(packet.schema, errors);
    }
    if (hasOwn(packet, "payload")) {
      validatePayload(packet.payload, errors);
    }

    const isMessageTypeString = typeof packet.msg_type === "string";

    return {
      valid: errors.length === 0,
      errors,
      isFixedSafeMessage: isMessageTypeString
        ? isFixedSafeMessage(packet.msg_type)
        : false,
    };
  }

  public isValid(packet: unknown): packet is RoverPacket {
    return this.validate(packet).valid;
  }
}

function validateSchema(value: unknown, errors: ValidationError[]): void {
  if (!isRecord(value)) {
    errors.push({
      path: "schema",
      code: "invalid_type",
      message: "schema must be an object",
    });
    return;
  }

  for (const field of requiredSchemaFields) {
    if (!hasOwn(value, field)) {
      errors.push({
        path: `schema.${field}`,
        code: "required",
        message: `schema.${field} is required`,
      });
      continue;
    }

    if (typeof value[field] !== "string" || value[field].length === 0) {
      errors.push({
        path: `schema.${field}`,
        code: "invalid_value",
        message: `schema.${field} must be a non-empty string`,
      });
    }
  }
}

function validatePayload(value: unknown, errors: ValidationError[]): void {
  if (!isRecord(value)) {
    errors.push({
      path: "payload",
      code: "invalid_type",
      message: "payload must be an object",
    });
  }
}

function validateNonNegativeInteger(
  packet: Record<string, unknown>,
  field: PacketNumericField,
  errors: ValidationError[],
): void {
  if (!hasOwn(packet, field)) {
    return;
  }

  const value = packet[field];
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > PACKET_NUMERIC_LIMITS[field]
  ) {
    errors.push({
      path: field,
      code: "invalid_value",
      message: `${field} must be a non-negative integer no greater than ${PACKET_NUMERIC_LIMITS[field]}`,
    });
  }
}

function validateNonEmptyString(
  packet: Record<string, unknown>,
  field: string,
  errors: ValidationError[],
): void {
  if (!hasOwn(packet, field)) {
    return;
  }

  const value = packet[field];
  if (typeof value !== "string" || value.length === 0) {
    errors.push({
      path: field,
      code: "invalid_value",
      message: `${field} must be a non-empty string`,
    });
  }
}

function requireField(
  packet: Record<string, unknown>,
  field: string,
  errors: ValidationError[],
): void {
  if (!hasOwn(packet, field)) {
    errors.push({
      path: field,
      code: "required",
      message: `${field} is required`,
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, field);
}
