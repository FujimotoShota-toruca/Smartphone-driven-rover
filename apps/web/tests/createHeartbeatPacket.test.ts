import { BLE_GATT_CONTRACT } from "@smartphone-rover/protocol";
import { describe, expect, it } from "vitest";

import { createHeartbeatPacket } from "../src/packet/createHeartbeatPacket";

const schema = {
  core_protocol_hash: "core",
  mission_db_hash: "mission",
  board_profile_hash: "board",
};

describe("createHeartbeatPacket", () => {
  it("creates a heartbeat RoverPacket using the common envelope", () => {
    expect(
      createHeartbeatPacket({
        missionId: "engineering_rover_demo",
        roverId: "rover_01",
        seq: 7,
        ttlMs: BLE_GATT_CONTRACT.heartbeatTimeoutMs,
        schema,
        nowMs: 1234,
      }),
    ).toEqual({
      protocol_version: 1,
      mission_id: "engineering_rover_demo",
      rover_id: "rover_01",
      packet_type: "command",
      msg_type: "heartbeat",
      seq: 7,
      timestamp_ms: 1234,
      ttl_ms: 1000,
      schema,
      payload: {
        node_id: "web_app",
      },
    });
  });
});
