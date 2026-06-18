import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { loadMissionProfiles } from "../src/loadMissionDb";
import { MissionProfileGuard } from "../src/MissionProfileGuard";
import type { MissionProfile, MissionProfileDefinition } from "../src/types";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

async function loadProfile(name: string): Promise<MissionProfileDefinition> {
  const profiles = await loadMissionProfiles(
    path.join(repoRoot, "mission", "missions"),
  );
  const profile = profiles.find((item) => item.mission_profile.name === name);
  if (!profile) {
    throw new Error(`missing profile ${name}`);
  }
  return profile;
}

describe("MissionProfileGuard", () => {
  it("always allows emergency_stop regardless of profile settings", async () => {
    const profile = await loadProfile("tanegashima_auto_control");
    const guard = new MissionProfileGuard(profile);

    expect(
      guard.evaluate({
        msgType: "emergency_stop",
        origin: "remote_ground",
        mode: "GNSS_GUIDANCE",
      }),
    ).toEqual({
      allowed: true,
      reason: "fixed_safe_message_allowed",
      errors: [],
      fixedSafeMessage: true,
      remoteCommand: true,
      manualCommand: false,
    });
  });

  it("rejects remote_ground cmd_vel for Tanegashima competition profile", async () => {
    const profile = await loadProfile("tanegashima_auto_control");
    const guard = new MissionProfileGuard(profile);
    const result = guard.evaluate({
      msgType: "cmd_vel",
      origin: "remote_ground",
      mode: "MANUAL",
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("manual_command_not_allowed");
    expect(result.remoteCommand).toBe(true);
    expect(result.manualCommand).toBe(true);
    expect(result.errors).toContain(
      "remote uplink is not allowed by mission profile",
    );
    expect(result.errors).toContain(
      "remote cmd_vel is disabled in competition profile",
    );
  });

  it("allows local_phone cmd_vel for engineering demo profile", async () => {
    const profile = await loadProfile("engineering_rover_demo");
    const guard = new MissionProfileGuard(profile);
    const result = guard.evaluate({
      msgType: "cmd_vel",
      origin: "local_phone",
      mode: "MANUAL",
    });

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("manual_command_allowed");
    expect(result.remoteCommand).toBe(false);
    expect(result.manualCommand).toBe(true);
  });

  it("rejects manual override when manual_override_allowed is false", async () => {
    const profile = await loadProfile("tanegashima_auto_control");
    const guard = new MissionProfileGuard(profile);
    const result = guard.evaluate({
      msgType: "cmd_vel",
      origin: "local_phone",
      mode: "GNSS_GUIDANCE",
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("manual_command_not_allowed");
    expect(result.errors).toContain(
      "manual override is not allowed by mission profile",
    );
  });

  it("allows manual override when manual_override_allowed is true", async () => {
    const profile = await loadProfile("engineering_rover_demo");
    const guard = new MissionProfileGuard(profile);
    const result = guard.evaluate({
      msgType: "cmd_vel",
      origin: "local_phone",
      mode: "GNSS_GUIDANCE",
    });

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("manual_command_allowed");
  });

  it("rejects remote/manual operations when profile policy omits explicit permission", () => {
    const profile: MissionProfile = {
      name: "minimal_safe_profile",
      policy: {},
    };
    const guard = new MissionProfileGuard(profile);

    expect(
      guard.evaluate({
        msgType: "cmd_vel",
        origin: "cloud",
        mode: "MANUAL",
      }),
    ).toMatchObject({
      allowed: false,
      reason: "manual_command_not_allowed",
      fixedSafeMessage: false,
      remoteCommand: true,
      manualCommand: true,
    });
  });

  it("accepts a RoverPacket input as the msg_type source", async () => {
    const profile = await loadProfile("engineering_rover_demo");
    const guard = new MissionProfileGuard(profile);
    const result = guard.evaluate({
      packet: {
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
        payload: {},
      },
      origin: "local_phone",
      mode: "MANUAL",
    });

    expect(result.allowed).toBe(true);
  });
});
