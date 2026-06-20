import { describe, expect, it } from "vitest";

import { createResetEstopPacket } from "../src/packet/createResetEstopPacket";

const schema = {
  core_protocol_hash: "core",
  mission_db_hash: "mission",
  board_profile_hash: "board",
};

describe("createResetEstopPacket", () => {
  it("creates a reset_estop command packet", () => {
    expect(
      createResetEstopPacket({
        missionId: "engineering_rover_demo",
        roverId: "rover_01",
        seq: 45,
        reason: "operator_reset",
        schema,
        nowMs: 123458,
      }),
    ).toEqual({
      protocol_version: 1,
      mission_id: "engineering_rover_demo",
      rover_id: "rover_01",
      packet_type: "command",
      msg_type: "reset_estop",
      seq: 45,
      timestamp_ms: 123458,
      ttl_ms: 1000,
      schema,
      payload: {
        reason: "operator_reset",
      },
    });
  });
});
