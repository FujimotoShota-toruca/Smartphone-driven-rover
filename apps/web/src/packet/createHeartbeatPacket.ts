import type { PacketSchema, RoverPacket } from "@smartphone-rover/protocol";

export interface CreateHeartbeatPacketOptions {
  missionId: string;
  roverId: string;
  seq: number;
  ttlMs: number;
  schema: PacketSchema;
  nowMs?: number;
  nodeId?: string;
}

export function createHeartbeatPacket(
  options: CreateHeartbeatPacketOptions,
): RoverPacket {
  return {
    protocol_version: 1,
    mission_id: options.missionId,
    rover_id: options.roverId,
    packet_type: "command",
    msg_type: "heartbeat",
    seq: options.seq,
    timestamp_ms: options.nowMs ?? Date.now(),
    ttl_ms: options.ttlMs,
    schema: options.schema,
    payload: {
      node_id: options.nodeId ?? "web_app",
    },
  };
}
