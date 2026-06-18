import type { RoverPacket } from "../../protocol/src/types";
import { isFixedSafeMessage } from "../../protocol/src/validation";

import type { MissionProfile, MissionProfileDefinition } from "./types";

export type CommandOrigin =
  | "local_phone"
  | "phone_autonomy"
  | "remote_ground"
  | "cloud"
  | "system";

export type MissionMode =
  | "IDLE"
  | "MANUAL"
  | "AUTO_ARMED"
  | "GNSS_GUIDANCE"
  | "CONE_SEARCH"
  | "CAM_VISUAL_SERVOING"
  | "GOAL"
  | "SAFE_STOP"
  | "MANUAL_OVERRIDE"
  | "ABORT"
  | string;

export interface MissionProfileGuardInput {
  packet?: RoverPacket;
  msgType?: string;
  origin: CommandOrigin;
  mode?: MissionMode;
}

export interface MissionProfileGuardResult {
  allowed: boolean;
  reason: string;
  errors: string[];
  fixedSafeMessage: boolean;
  remoteCommand: boolean;
  manualCommand: boolean;
}

const autonomousModes = new Set<string>([
  "AUTO_ARMED",
  "GNSS_GUIDANCE",
  "CONE_SEARCH",
  "CAM_VISUAL_SERVOING",
]);

export class MissionProfileGuard {
  readonly #profile: MissionProfile;

  public constructor(profile: MissionProfile | MissionProfileDefinition) {
    this.#profile = isMissionProfileDefinition(profile)
      ? profile.mission_profile
      : profile;
  }

  public evaluate(input: MissionProfileGuardInput): MissionProfileGuardResult {
    const msgType = input.packet?.msg_type ?? input.msgType;
    const fixedSafeMessage = isFixedSafeMessage(msgType);
    const remoteCommand = isRemoteOrigin(input.origin);
    const manualCommand = isManualCommand(msgType);

    if (fixedSafeMessage) {
      return {
        allowed: true,
        reason: "fixed_safe_message_allowed",
        errors: [],
        fixedSafeMessage,
        remoteCommand,
        manualCommand,
      };
    }

    const errors: string[] = [];
    if (!msgType) {
      errors.push("msg_type is required");
    }

    if (remoteCommand && this.#profile.policy?.remote_uplink_allowed !== true) {
      errors.push("remote uplink is not allowed by mission profile");
    }

    if (manualCommand) {
      if (this.#profile.policy?.remote_manual_cmd_allowed !== true) {
        errors.push("manual command is not allowed by mission profile");
      }

      if (
        isManualOverride(input.mode) &&
        this.#profile.policy?.manual_override_allowed !== true
      ) {
        errors.push("manual override is not allowed by mission profile");
      }
    }

    if (remoteCommand && manualCommand) {
      const disabledCapabilities =
        this.#profile.disabled_capabilities_in_competition;
      if (
        Array.isArray(disabledCapabilities) &&
        disabledCapabilities.includes("remote_manual_cmd_vel")
      ) {
        errors.push("remote cmd_vel is disabled in competition profile");
      }
    }

    if (manualCommand && this.#profile.policy?.remote_manual_cmd_allowed !== true) {
      return denied(errors, "manual_command_not_allowed", {
        fixedSafeMessage,
        remoteCommand,
        manualCommand,
      });
    }

    if (remoteCommand && this.#profile.policy?.remote_uplink_allowed !== true) {
      return denied(errors, "remote_uplink_not_allowed", {
        fixedSafeMessage,
        remoteCommand,
        manualCommand,
      });
    }

    if (
      manualCommand &&
      isManualOverride(input.mode) &&
      this.#profile.policy?.manual_override_allowed !== true
    ) {
      return denied(errors, "manual_override_not_allowed", {
        fixedSafeMessage,
        remoteCommand,
        manualCommand,
      });
    }

    if (errors.length > 0) {
      return denied(errors, "mission_profile_policy_rejected", {
        fixedSafeMessage,
        remoteCommand,
        manualCommand,
      });
    }

    if (manualCommand) {
      return allowed("manual_command_allowed", {
        fixedSafeMessage,
        remoteCommand,
        manualCommand,
      });
    }

    if (remoteCommand) {
      return allowed("remote_command_allowed", {
        fixedSafeMessage,
        remoteCommand,
        manualCommand,
      });
    }

    if (input.origin === "system" || input.origin === "phone_autonomy") {
      return allowed("profile_not_restrictive_for_origin", {
        fixedSafeMessage,
        remoteCommand,
        manualCommand,
      });
    }

    return denied(["operation is not explicitly allowed by mission profile"], "not_explicitly_allowed", {
      fixedSafeMessage,
      remoteCommand,
      manualCommand,
    });
  }
}

function isMissionProfileDefinition(
  value: MissionProfile | MissionProfileDefinition,
): value is MissionProfileDefinition {
  return "mission_profile" in value && isMissionProfile(value.mission_profile);
}

function isMissionProfile(value: unknown): value is MissionProfile {
  return typeof value === "object" && value !== null && "name" in value;
}

function isRemoteOrigin(origin: CommandOrigin): boolean {
  return origin === "remote_ground" || origin === "cloud";
}

function isManualCommand(msgType: unknown): boolean {
  return msgType === "cmd_vel" || msgType === "manual_override";
}

function isManualOverride(mode: MissionMode | undefined): boolean {
  return mode === "MANUAL_OVERRIDE" || autonomousModes.has(mode ?? "");
}

function allowed(
  reason: string,
  flags: Pick<
    MissionProfileGuardResult,
    "fixedSafeMessage" | "remoteCommand" | "manualCommand"
  >,
): MissionProfileGuardResult {
  return {
    allowed: true,
    reason,
    errors: [],
    ...flags,
  };
}

function denied(
  errors: string[],
  reason: string,
  flags: Pick<
    MissionProfileGuardResult,
    "fixedSafeMessage" | "remoteCommand" | "manualCommand"
  >,
): MissionProfileGuardResult {
  return {
    allowed: false,
    reason,
    errors,
    ...flags,
  };
}
