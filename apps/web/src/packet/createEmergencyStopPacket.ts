import type { PacketSchema, RoverPacket } from "@smartphone-rover/protocol";

export interface CreateEmergencyStopPacketOptions {
  missionId: string;
  roverId: string;
  seq: number;
  reason: string;
  schema: PacketSchema;
  nowMs?: number;
}

export function createEmergencyStopPacket(
  options: CreateEmergencyStopPacketOptions,
): RoverPacket {
  return {
    protocol_version: 1,
    mission_id: options.missionId,
    rover_id: options.roverId,
    packet_type: "command",
    msg_type: "emergency_stop",
    seq: options.seq,
    timestamp_ms: options.nowMs ?? Date.now(),
    ttl_ms: 1000,
    schema: options.schema,
    payload: {
      reason: options.reason,
    },
  };
}
