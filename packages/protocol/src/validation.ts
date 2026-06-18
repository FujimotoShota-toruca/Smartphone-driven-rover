export const FIXED_SAFE_MESSAGE_TYPES = [
  "emergency_stop",
  "heartbeat",
  "basic_status",
  "disconnect",
  "read_schema_info",
] as const;

export type FixedSafeMessageType = (typeof FIXED_SAFE_MESSAGE_TYPES)[number];

export type ValidationErrorCode =
  | "required"
  | "invalid_type"
  | "invalid_value";

export interface ValidationError {
  path: string;
  code: ValidationErrorCode;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  isFixedSafeMessage: boolean;
}

const fixedSafeMessageTypes = new Set<string>(FIXED_SAFE_MESSAGE_TYPES);

export function isFixedSafeMessage(
  msgType: unknown,
): msgType is FixedSafeMessageType {
  return typeof msgType === "string" && fixedSafeMessageTypes.has(msgType);
}
