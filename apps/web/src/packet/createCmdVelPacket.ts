import type { PacketSchema, RoverPacket } from "@smartphone-rover/protocol";

export interface CreateCmdVelPacketOptions {
  missionId: string;
  roverId: string;
  seq: number;
  vx: number;
  wz: number;
  brake?: boolean;
  mode?: "manual_pwm";
  leftPwm?: number;
  rightPwm?: number;
  coast?: boolean;
  ttlMs: number;
  schema: PacketSchema;
  nowMs?: number;
}

export function createCmdVelPacket(
  options: CreateCmdVelPacketOptions,
): RoverPacket {
  return {
    protocol_version: 1,
    mission_id: options.missionId,
    rover_id: options.roverId,
    packet_type: "command",
    msg_type: "cmd_vel",
    seq: options.seq,
    timestamp_ms: options.nowMs ?? Date.now(),
    ttl_ms: options.ttlMs,
    schema: options.schema,
    payload: {
      vx: options.vx,
      wz: options.wz,
      brake: options.brake ?? false,
      ...(options.mode ? { mode: options.mode } : {}),
      ...(options.leftPwm === undefined ? {} : { left_pwm: options.leftPwm }),
      ...(options.rightPwm === undefined ? {} : { right_pwm: options.rightPwm }),
      ...(options.coast === undefined ? {} : { coast: options.coast }),
    },
  };
}
