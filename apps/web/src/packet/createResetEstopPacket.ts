import type { PacketSchema, RoverPacket } from "@smartphone-rover/protocol";

export interface CreateResetEstopPacketOptions {
  missionId: string;
  roverId: string;
  seq: number;
  reason: string;
  schema: PacketSchema;
  nowMs?: number;
}

export function createResetEstopPacket(
  options: CreateResetEstopPacketOptions,
): RoverPacket {
  return {
    protocol_version: 1,
    mission_id: options.missionId,
    rover_id: options.roverId,
    packet_type: "command",
    msg_type: "reset_estop",
    seq: options.seq,
    timestamp_ms: options.nowMs ?? Date.now(),
    ttl_ms: 1000,
    schema: options.schema,
    payload: {
      reason: options.reason,
    },
  };
}
