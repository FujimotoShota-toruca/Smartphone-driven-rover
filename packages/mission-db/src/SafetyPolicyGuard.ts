import type { RoverPacket } from "../../protocol/src/types";
import { isFixedSafeMessage } from "../../protocol/src/validation";

import type { MissionProfilePolicy, SafetyDefinition, SafetyPolicy } from "./types";
import type { MissionMode } from "./MissionProfileGuard";

export interface SafetyPolicyGuardInput {
  packet?: RoverPacket;
  msgType?: string;
  payload?: Record<string, unknown>;
  ttlMs?: number;
  mode?: MissionMode;
}

export interface SafetyPolicyGuardResult {
  allowed: boolean;
  reason: string;
  errors: string[];
  fixedSafeMessage: boolean;
  safetyChecked: boolean;
}

export class SafetyPolicyGuard {
  readonly #policy: SafetyPolicy | MissionProfilePolicy;

  public constructor(policy: SafetyPolicy | MissionProfilePolicy | SafetyDefinition) {
    this.#policy = isSafetyDefinition(policy) ? policy.policy_defaults : policy;
  }

  public evaluate(input: SafetyPolicyGuardInput): SafetyPolicyGuardResult {
    const msgType = input.packet?.msg_type ?? input.msgType;
    const fixedSafeMessage = isFixedSafeMessage(msgType);

    if (fixedSafeMessage) {
      return {
        allowed: true,
        reason: "fixed_safe_message_allowed",
        errors: [],
        fixedSafeMessage,
        safetyChecked: false,
      };
    }

    if (msgType === "cmd_vel") {
      return this.#evaluateCmdVel(input, fixedSafeMessage);
    }

    if (isReleaseCommand(msgType)) {
      return this.#evaluateReleaseCommand(input, fixedSafeMessage);
    }

    return {
      allowed: false,
      reason: "unsupported_command",
      errors: [`unsupported command for safety policy: ${String(msgType)}`],
      fixedSafeMessage,
      safetyChecked: false,
    };
  }

  #evaluateCmdVel(
    input: SafetyPolicyGuardInput,
    fixedSafeMessage: boolean,
  ): SafetyPolicyGuardResult {
    const errors: string[] = [];
    const payload = input.packet?.payload ?? input.payload;
    const ttlMs = input.packet?.ttl_ms ?? input.ttlMs;

    const maxVx = this.#policy.max_vx;
    const maxWz = this.#policy.max_wz;
    const maxTtlMs = this.#policy.cmd_vel_default_ttl_ms;

    if (typeof maxVx !== "number" || !Number.isFinite(maxVx)) {
      errors.push("max_vx is required");
    }
    if (typeof maxWz !== "number" || !Number.isFinite(maxWz)) {
      errors.push("max_wz is required");
    }
    if (typeof maxTtlMs !== "number" || !Number.isFinite(maxTtlMs)) {
      errors.push("cmd_vel_default_ttl_ms is required");
    }

    if (!isRecord(payload)) {
      errors.push("payload must be an object");
    } else {
      validateFiniteNumber(payload.vx, "payload.vx", errors);
      validateFiniteNumber(payload.wz, "payload.wz", errors);

      if (
        typeof payload.vx === "number" &&
        Number.isFinite(payload.vx) &&
        typeof maxVx === "number" &&
        Number.isFinite(maxVx) &&
        Math.abs(payload.vx) > maxVx
      ) {
        errors.push("payload.vx exceeds max_vx");
      }

      if (
        typeof payload.wz === "number" &&
        Number.isFinite(payload.wz) &&
        typeof maxWz === "number" &&
        Number.isFinite(maxWz) &&
        Math.abs(payload.wz) > maxWz
      ) {
        errors.push("payload.wz exceeds max_wz");
      }
    }

    if (typeof ttlMs !== "number" || !Number.isFinite(ttlMs)) {
      errors.push("ttl_ms must be a finite number");
    } else if (
      typeof maxTtlMs === "number" &&
      Number.isFinite(maxTtlMs) &&
      ttlMs > maxTtlMs
    ) {
      errors.push("ttl_ms exceeds cmd_vel_default_ttl_ms");
    }

    return {
      allowed: errors.length === 0,
      reason: errors.length === 0 ? "cmd_vel_safety_policy_allowed" : "cmd_vel_safety_policy_rejected",
      errors,
      fixedSafeMessage,
      safetyChecked: true,
    };
  }

  #evaluateReleaseCommand(
    input: SafetyPolicyGuardInput,
    fixedSafeMessage: boolean,
  ): SafetyPolicyGuardResult {
    const allowedModes = this.#policy.release_allowed_modes;
    const errors: string[] = [];

    if (!Array.isArray(allowedModes) || allowedModes.length === 0) {
      errors.push("release_allowed_modes is required");
    } else if (!input.mode || !allowedModes.includes(input.mode)) {
      errors.push("current mode is not allowed for release command");
    }

    return {
      allowed: errors.length === 0,
      reason: errors.length === 0 ? "release_safety_policy_allowed" : "release_safety_policy_rejected",
      errors,
      fixedSafeMessage,
      safetyChecked: true,
    };
  }
}

function isSafetyDefinition(
  value: SafetyPolicy | MissionProfilePolicy | SafetyDefinition,
): value is SafetyDefinition {
  return "policy_defaults" in value && isRecord(value.policy_defaults);
}

function isReleaseCommand(msgType: unknown): boolean {
  return msgType === "fire_nichrome" || msgType === "arm_release";
}

function validateFiniteNumber(
  value: unknown,
  path: string,
  errors: string[],
): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`${path} must be a finite number`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
