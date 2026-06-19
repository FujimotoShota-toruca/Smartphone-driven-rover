import { describe, expect, it } from "vitest";

import { createCmdVelPacket } from "../src/packet/createCmdVelPacket";

const schema = {
  core_protocol_hash: "core",
  mission_db_hash: "mission",
  board_profile_hash: "board",
};

describe("createCmdVelPacket", () => {
  it("creates a cmd_vel RoverPacket with seq, timestamp, ttl, schema, and payload", () => {
    expect(
      createCmdVelPacket({
        missionId: "engineering_rover_demo",
        roverId: "rover_01",
        seq: 42,
        vx: 0.25,
        wz: -0.5,
        brake: false,
        ttlMs: 300,
        schema,
        nowMs: 123456,
      }),
    ).toEqual({
      protocol_version: 1,
      mission_id: "engineering_rover_demo",
      rover_id: "rover_01",
      packet_type: "command",
      msg_type: "cmd_vel",
      seq: 42,
      timestamp_ms: 123456,
      ttl_ms: 300,
      schema,
      payload: {
        vx: 0.25,
        wz: -0.5,
        brake: false,
      },
    });
  });

  it("can include Lv1 manual_pwm payload fields", () => {
    const packet = createCmdVelPacket({
      missionId: "engineering_rover_demo",
      roverId: "rover_01",
      seq: 43,
      vx: 0,
      wz: 1,
      brake: false,
      mode: "manual_pwm",
      leftPwm: -1,
      rightPwm: 1,
      ttlMs: 300,
      schema,
      nowMs: 123457,
    });

    expect(packet.payload).toEqual({
      vx: 0,
      wz: 1,
      brake: false,
      mode: "manual_pwm",
      left_pwm: -1,
      right_pwm: 1,
    });
  });
});
