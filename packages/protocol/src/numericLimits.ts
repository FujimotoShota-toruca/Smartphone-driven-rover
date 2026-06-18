export const PACKET_NUMERIC_LIMITS = {
  protocol_version: 0xff,
  seq: 0xffffffff,
  timestamp_ms: Number.MAX_SAFE_INTEGER,
  ttl_ms: 0xffffffff,
} as const;

export type PacketNumericField = keyof typeof PACKET_NUMERIC_LIMITS;
