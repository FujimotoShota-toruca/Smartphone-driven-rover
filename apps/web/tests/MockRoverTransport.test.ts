import { describe, expect, it } from "vitest";
import {
  CommandAuthorizationPipeline,
} from "@smartphone-rover/mission-db/CommandAuthorizationPipeline";
import { CommandRegistry } from "@smartphone-rover/mission-db/CommandRegistry";
import type { MissionDbHashes } from "@smartphone-rover/mission-db/types";

import { createCmdVelPacket } from "../src/packet/createCmdVelPacket";
import { MockRoverTransport } from "../src/transport/MockRoverTransport";

const schema: MissionDbHashes = {
  core_protocol_hash: "core",
  mission_db_hash: "mission",
  board_profile_hash: "board",
};

const packet = createCmdVelPacket({
  missionId: "engineering_rover_demo",
  roverId: "rover_01",
  seq: 1,
  vx: 0.25,
  wz: 0,
  ttlMs: 300,
  schema,
  nowMs: 1000,
});

describe("MockRoverTransport", () => {
  it("connects, disconnects, and stores sent packets", async () => {
    const transport = new MockRoverTransport();

    expect(transport.isConnected()).toBe(false);
    await transport.connect();
    expect(transport.isConnected()).toBe(true);
    await transport.send(packet);
    expect(transport.getSentPackets()).toEqual([packet]);
    await transport.disconnect();
    expect(transport.isConnected()).toBe(false);
  });

  it("rejects send while disconnected", async () => {
    const transport = new MockRoverTransport();

    await expect(transport.send(packet)).rejects.toThrow(
      "MockRoverTransport is not connected",
    );
  });

  it("does not send packets rejected by authorization", async () => {
    const transport = new MockRoverTransport();
    const pipeline = new CommandAuthorizationPipeline();
    await transport.connect();

    const rejectedPacket = {
      ...packet,
      msg_type: "unknown_command",
    };
    const result = pipeline.evaluate({
      packet: rejectedPacket,
      missionProfile: {
        schema_version: 1,
        mission_profile: {
          name: "engineering_rover_demo",
          policy: {
            manual_override_allowed: true,
            remote_manual_cmd_allowed: true,
            remote_uplink_allowed: true,
          },
        },
      },
      boardProfile: {
        schema_version: 1,
        board_profile: {
          name: "minimal_2wheel_pico_board",
          capabilities: {
            drive_control: true,
          },
        },
      },
      safetyPolicy: {
        schema_version: 1,
        fixed_safety_kernel: {},
        policy_defaults: {
          max_vx: 0.5,
          max_wz: 2,
          cmd_vel_default_ttl_ms: 300,
        },
      },
      currentHashes: schema,
      registry: new CommandRegistry({ commands: ["cmd_vel"] }),
      origin: "local_phone",
      mode: "MANUAL",
    });

    if (result.authorized) {
      await transport.send(rejectedPacket);
    }

    expect(result.authorized).toBe(false);
    expect(transport.getSentPackets()).toEqual([]);
  });
});
