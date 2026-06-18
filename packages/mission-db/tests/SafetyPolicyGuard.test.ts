import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { loadMissionDb } from "../src/loadMissionDb";
import { SafetyPolicyGuard } from "../src/SafetyPolicyGuard";
import type { SafetyPolicy } from "../src/types";
import type { RoverPacket } from "../../protocol/src/types";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const basePolicy: SafetyPolicy = {
  max_vx: 0.5,
  max_wz: 2.0,
  cmd_vel_default_ttl_ms: 300,
  release_allowed_modes: ["MANUAL"],
};

const cmdVelPacket: RoverPacket = {
  protocol_version: 1,
  mission_id: "engineering_rover_demo",
  rover_id: "rover_01",
  packet_type: "command",
  msg_type: "cmd_vel",
  seq: 1,
  timestamp_ms: 100,
  ttl_ms: 300,
  schema: {
    core_protocol_hash: "core",
    mission_db_hash: "mission",
    board_profile_hash: "board",
  },
  payload: {
    vx: 0.25,
    wz: 1.0,
  },
};

describe("SafetyPolicyGuard", () => {
  it("allows cmd_vel values within max_vx and max_wz", () => {
    const guard = new SafetyPolicyGuard(basePolicy);

    expect(guard.evaluate({ packet: cmdVelPacket })).toEqual({
      allowed: true,
      reason: "cmd_vel_safety_policy_allowed",
      errors: [],
      fixedSafeMessage: false,
      safetyChecked: true,
    });
  });

  it("rejects cmd_vel when max_vx is exceeded", () => {
    const guard = new SafetyPolicyGuard(basePolicy);
    const result = guard.evaluate({
      packet: {
        ...cmdVelPacket,
        payload: { vx: 0.51, wz: 1.0 },
      },
    });

    expect(result.allowed).toBe(false);
    expect(result.errors).toContain("payload.vx exceeds max_vx");
  });

  it("rejects cmd_vel when max_wz is exceeded", () => {
    const guard = new SafetyPolicyGuard(basePolicy);
    const result = guard.evaluate({
      packet: {
        ...cmdVelPacket,
        payload: { vx: 0.25, wz: 2.01 },
      },
    });

    expect(result.allowed).toBe(false);
    expect(result.errors).toContain("payload.wz exceeds max_wz");
  });

  it.each([
    { vx: "fast", wz: 1.0 },
    { vx: 0.25, wz: Number.NaN },
    { vx: Number.POSITIVE_INFINITY, wz: 1.0 },
  ])("rejects non-finite cmd_vel payload values %#", (payload) => {
    const guard = new SafetyPolicyGuard(basePolicy);
    const result = guard.evaluate({
      packet: {
        ...cmdVelPacket,
        payload,
      },
    });

    expect(result.allowed).toBe(false);
  });

  it("rejects cmd_vel when ttl_ms exceeds the policy maximum", () => {
    const guard = new SafetyPolicyGuard(basePolicy);
    const result = guard.evaluate({
      packet: {
        ...cmdVelPacket,
        ttl_ms: 301,
      },
    });

    expect(result.allowed).toBe(false);
    expect(result.errors).toContain("ttl_ms exceeds cmd_vel_default_ttl_ms");
  });

  it("rejects cmd_vel safely when max_vx, max_wz, or TTL maximum is missing", () => {
    const guard = new SafetyPolicyGuard({});
    const result = guard.evaluate({ packet: cmdVelPacket });

    expect(result.allowed).toBe(false);
    expect(result.errors).toContain("max_vx is required");
    expect(result.errors).toContain("max_wz is required");
    expect(result.errors).toContain("cmd_vel_default_ttl_ms is required");
  });

  it("allows emergency_stop regardless of policy settings", () => {
    const guard = new SafetyPolicyGuard({});
    const result = guard.evaluate({
      packet: {
        ...cmdVelPacket,
        msg_type: "emergency_stop",
        payload: {},
      },
    });

    expect(result).toEqual({
      allowed: true,
      reason: "fixed_safe_message_allowed",
      errors: [],
      fixedSafeMessage: true,
      safetyChecked: false,
    });
  });

  it("rejects fire_nichrome when current mode is not release_allowed_modes", () => {
    const guard = new SafetyPolicyGuard(basePolicy);
    const result = guard.evaluate({
      msgType: "fire_nichrome",
      payload: { duration_ms: 1000 },
      mode: "GNSS_GUIDANCE",
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("release_safety_policy_rejected");
    expect(result.errors).toContain(
      "current mode is not allowed for release command",
    );
  });

  it("allows fire_nichrome when current mode is release_allowed_modes", () => {
    const guard = new SafetyPolicyGuard(basePolicy);
    const result = guard.evaluate({
      msgType: "fire_nichrome",
      payload: { duration_ms: 1000 },
      mode: "MANUAL",
    });

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("release_safety_policy_allowed");
  });

  it("rejects unsupported normal commands", () => {
    const guard = new SafetyPolicyGuard(basePolicy);

    expect(
      guard.evaluate({
        msgType: "reset_estop",
        payload: { confirm: true },
      }),
    ).toMatchObject({
      allowed: false,
      reason: "unsupported_command",
      safetyChecked: false,
    });
  });

  it("can use policy_defaults from the loaded safety definition", async () => {
    const missionDb = await loadMissionDb(repoRoot);
    const guard = new SafetyPolicyGuard(missionDb.safety);

    expect(guard.evaluate({ packet: cmdVelPacket }).allowed).toBe(true);
  });
});
