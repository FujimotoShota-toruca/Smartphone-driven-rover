export interface PacketSchema {
  core_protocol_hash: string;
  mission_db_hash: string;
  board_profile_hash: string;
}

export interface RoverPacket<
  TPayload extends Record<string, unknown> = Record<string, unknown>,
> {
  protocol_version: number;
  mission_id: string;
  rover_id: string;
  packet_type: string;
  msg_type: string;
  seq: number;
  timestamp_ms: number;
  ttl_ms: number;
  schema: PacketSchema;
  payload: TPayload;
}
