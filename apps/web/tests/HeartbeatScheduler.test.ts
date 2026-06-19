import { describe, expect, it, vi } from "vitest";

import { createHeartbeatPacket } from "../src/packet/createHeartbeatPacket";
import { sendHeartbeatIfIdle } from "../src/heartbeat/HeartbeatScheduler";
import type { HeartbeatWriteAwareTransport } from "../src/heartbeat/HeartbeatScheduler";

const schema = {
  core_protocol_hash: "core",
  mission_db_hash: "mission",
  board_profile_hash: "board",
};

const heartbeat = createHeartbeatPacket({
  missionId: "engineering_rover_demo",
  roverId: "rover_01",
  seq: 1,
  ttlMs: 1000,
  schema,
  nowMs: 1000,
});

describe("sendHeartbeatIfIdle", () => {
  it("skips a heartbeat while another heartbeat is in flight", async () => {
    const transport = createTransport();
    const inFlight = { current: true };

    await expect(
      sendHeartbeatIfIdle({ transport, packet: heartbeat, inFlight }),
    ).resolves.toBe(false);

    expect(transport.send).not.toHaveBeenCalled();
  });

  it("skips a heartbeat while the GATT writer is busy", async () => {
    const transport = createTransport({ writeInProgress: true });
    const inFlight = { current: false };

    await expect(
      sendHeartbeatIfIdle({ transport, packet: heartbeat, inFlight }),
    ).resolves.toBe(false);

    expect(transport.send).not.toHaveBeenCalled();
  });

  it("sends one heartbeat and clears the in-flight flag", async () => {
    const transport = createTransport();
    const inFlight = { current: false };

    await expect(
      sendHeartbeatIfIdle({ transport, packet: heartbeat, inFlight }),
    ).resolves.toBe(true);

    expect(transport.send).toHaveBeenCalledWith(heartbeat);
    expect(inFlight.current).toBe(false);
  });
});

function createTransport(options: { writeInProgress?: boolean } = {}): HeartbeatWriteAwareTransport {
  return {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    send: vi.fn(async () => undefined),
    isConnected: vi.fn(() => true),
    isWriteInProgress: vi.fn(() => options.writeInProgress ?? false),
  };
}
