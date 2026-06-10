import { describe, expect, it } from "vitest";

import { JsonPacketCodec } from "../src/JsonPacketCodec";
import { CodecError } from "../src/PacketCodec";
import type { RoverPacket } from "../src/types";

const packet: RoverPacket = {
  protocol_version: 1,
  mission_id: "engineering_rover_demo",
  rover_id: "rover_01",
  packet_type: "command",
  msg_type: "cmd_vel",
  seq: 1024,
  timestamp_ms: 12_345_678,
  ttl_ms: 300,
  schema: {
    core_protocol_hash: "core-abc",
    mission_db_hash: "mission-def",
    board_profile_hash: "board-ghi",
  },
  payload: {
    vx: 0.25,
    wz: -0.5,
    brake: false,
  },
};

describe("JsonPacketCodec", () => {
  const codec = new JsonPacketCodec();

  it("round-trips a RoverPacket through Uint8Array", () => {
    const encoded = codec.encode(packet);
    const decoded = codec.decode(encoded);

    expect(encoded).toBeInstanceOf(Uint8Array);
    expect(decoded).toEqual(packet);
  });

  it("throws CodecError for invalid JSON", () => {
    const invalidJson = new TextEncoder().encode('{"protocol_version":');

    expect(() => codec.decode(invalidJson)).toThrow(CodecError);
  });

  it("throws CodecError when a required field is missing", () => {
    const { mission_id: _missionId, ...missingMissionId } = packet;
    const encoded = new TextEncoder().encode(JSON.stringify(missingMissionId));

    expect(() => codec.decode(encoded)).toThrow(CodecError);
  });

  it("throws CodecError when encoding an invalid packet", () => {
    const invalidPacket = {
      ...packet,
      ttl_ms: -1,
    } as RoverPacket;

    expect(() => codec.encode(invalidPacket)).toThrow(CodecError);
  });
});
