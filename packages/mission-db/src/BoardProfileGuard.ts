import type { RoverPacket } from "../../protocol/src/types";
import { isFixedSafeMessage } from "../../protocol/src/validation";

import type { BoardProfile, BoardProfileDefinition } from "./types";
import type { MissionMode } from "./MissionProfileGuard";

export interface BoardProfileGuardInput {
  packet?: RoverPacket;
  msgType?: string;
  payload?: Record<string, unknown>;
  mode?: MissionMode;
}

export interface BoardProfileGuardResult {
  allowed: boolean;
  reason: string;
  errors: string[];
  fixedSafeMessage: boolean;
  requiredCapability: string | null;
  capabilityAvailable: boolean;
}

export class BoardProfileGuard {
  readonly #profile: BoardProfile;

  public constructor(profile: BoardProfile | BoardProfileDefinition) {
    this.#profile = isBoardProfileDefinition(profile)
      ? profile.board_profile
      : profile;
  }

  public evaluate(input: BoardProfileGuardInput): BoardProfileGuardResult {
    const msgType = input.packet?.msg_type ?? input.msgType;
    const fixedSafeMessage = isFixedSafeMessage(msgType);

    if (fixedSafeMessage) {
      return {
        allowed: true,
        reason: "fixed_safe_message_allowed",
        errors: [],
        fixedSafeMessage,
        requiredCapability: null,
        capabilityAvailable: true,
      };
    }

    const requiredCapability = requiredCapabilityForMessage(msgType);
    if (requiredCapability === null) {
      return {
        allowed: false,
        reason: "unsupported_command",
        errors: [`unsupported command for board profile: ${String(msgType)}`],
        fixedSafeMessage,
        requiredCapability,
        capabilityAvailable: false,
      };
    }

    const capabilityAvailable = hasCapability(this.#profile, requiredCapability);
    return {
      allowed: capabilityAvailable,
      reason: capabilityAvailable
        ? "board_capability_available"
        : "board_capability_missing",
      errors: capabilityAvailable
        ? []
        : [`required capability is missing: ${requiredCapability}`],
      fixedSafeMessage,
      requiredCapability,
      capabilityAvailable,
    };
  }
}

function requiredCapabilityForMessage(msgType: unknown): string | null {
  switch (msgType) {
    case "cmd_vel":
      return "drive_control";
    case "fire_nichrome":
    case "arm_release":
      return "release_mechanism";
    case "pico_hk":
      return "local_telemetry";
    case "release_status":
      return "release_detection";
    case "local_log_status":
      return "local_logging";
    case "cds_reading":
      return "external_sensor_if";
    case "limit_switch":
      return "release_detection";
    default:
      return null;
  }
}

function hasCapability(profile: BoardProfile, capability: string): boolean {
  if (profile.capabilities?.[capability] === true) {
    return true;
  }

  if (capability === "local_telemetry") {
    return profile.capabilities?.safety_supervisor === true;
  }

  return false;
}

function isBoardProfileDefinition(
  value: BoardProfile | BoardProfileDefinition,
): value is BoardProfileDefinition {
  return "board_profile" in value && isBoardProfile(value.board_profile);
}

function isBoardProfile(value: unknown): value is BoardProfile {
  return typeof value === "object" && value !== null && "name" in value;
}
