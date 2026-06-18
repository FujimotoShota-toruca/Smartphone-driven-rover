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
});
