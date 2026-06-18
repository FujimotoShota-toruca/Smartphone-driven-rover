import { describe, expect, it } from "vitest";

import { canonicalJson } from "../src/canonicalJson";
import { hashMissionDb, sha256CanonicalJson } from "../src/hashMissionDb";
import type { MissionDb } from "../src/types";

const missionDb: MissionDb = {
  commands: {
    schema_version: 1,
    commands: {
      cmd_vel: {
        destination: "pico",
        fields: {
          vx: { type: "float32" },
          wz: { type: "float32" },
        },
      },
    },
  },
  telemetry: {
    schema_version: 1,
    telemetry: {
      pico_hk: {
        source: "pico",
        fields: {
          estop: { type: "bool" },
        },
      },
    },
  },
  safety: {
    schema_version: 1,
    fixed_safety_kernel: {
      estop: { enabled: true, latch: true },
    },
    policy_defaults: {
      heartbeat_timeout_ms: 1000,
    },
  },
  missionProfiles: [
    {
      schema_version: 1,
      mission_profile: {
        name: "engineering_rover_demo",
      },
    },
  ],
  boardProfiles: [
    {
      schema_version: 1,
      board_profile: {
        name: "minimal_2wheel_pico_board",
      },
    },
  ],
};

describe("canonicalJson", () => {
  it("sorts object keys recursively", () => {
    expect(canonicalJson({ b: 1, a: { d: 4, c: 3 } })).toBe(
      '{"a":{"c":3,"d":4},"b":1}',
    );
  });

  it("produces the same output for objects with the same content in different key orders", () => {
    const left = {
      b: [{ y: 2, x: 1 }],
      a: "same",
    };
    const right = {
      a: "same",
      b: [{ x: 1, y: 2 }],
    };

    expect(canonicalJson(left)).toBe(canonicalJson(right));
  });
});

describe("hashMissionDb", () => {
  it("returns the expected hash fields", () => {
    const hashes = hashMissionDb(missionDb);

    expect(hashes.core_protocol_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashes.mission_db_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashes.board_profile_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("keeps the same hash for the same meaning with different key order", () => {
    const left = sha256CanonicalJson({ b: 2, a: { d: 4, c: 3 } });
    const right = sha256CanonicalJson({ a: { c: 3, d: 4 }, b: 2 });

    expect(left).toBe(right);
  });

  it("changes the hash when content changes", () => {
    const original = hashMissionDb(missionDb);
    const changed = hashMissionDb({
      ...missionDb,
      safety: {
        ...missionDb.safety,
        policy_defaults: {
          heartbeat_timeout_ms: 2000,
        },
      },
    });

    expect(changed.mission_db_hash).not.toBe(original.mission_db_hash);
  });
});
