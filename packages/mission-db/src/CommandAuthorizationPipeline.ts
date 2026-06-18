import { PacketEnvelopeValidator } from "../../protocol/src/PacketEnvelopeValidator";
import type { RoverPacket } from "../../protocol/src/types";

import { BoardProfileGuard } from "./BoardProfileGuard";
import { CommandRegistry } from "./CommandRegistry";
import {
  type CommandOrigin,
  MissionProfileGuard,
  type MissionMode,
} from "./MissionProfileGuard";
import { PacketAdmissionGuard } from "./PacketAdmissionGuard";
import { SafetyPolicyGuard } from "./SafetyPolicyGuard";
import { SchemaHashGuard } from "./SchemaHashGuard";
import type {
  BoardProfile,
  BoardProfileDefinition,
  MissionDbHashes,
  MissionProfile,
  MissionProfileDefinition,
  SafetyDefinition,
  SafetyPolicy,
} from "./types";

export type CommandAuthorizationStage =
  | "packet_admission"
  | "mission_profile"
  | "safety_policy"
  | "board_profile"
  | "authorized";

export interface CommandAuthorizationInput {
  packet: unknown;
  missionProfile: MissionProfile | MissionProfileDefinition;
  boardProfile: BoardProfile | BoardProfileDefinition;
  safetyPolicy: SafetyPolicy | SafetyDefinition;
  currentHashes: MissionDbHashes;
  registry: CommandRegistry;
  origin: CommandOrigin;
  mode?: MissionMode;
}

export interface CommandAuthorizationResult {
  authorized: boolean;
  reason: string;
  errors: string[];
  stage: CommandAuthorizationStage;
  packetAdmitted: boolean;
  missionAllowed: boolean;
  safetyAllowed: boolean;
  boardAllowed: boolean;
  fixedSafeMessage: boolean;
}

export class CommandAuthorizationPipeline {
  readonly #envelopeValidator = new PacketEnvelopeValidator();

  public evaluate(input: CommandAuthorizationInput): CommandAuthorizationResult {
    const packetAdmissionGuard = new PacketAdmissionGuard({
      registry: input.registry,
      schemaHashGuard: new SchemaHashGuard(input.currentHashes, input.registry),
      envelopeValidator: this.#envelopeValidator,
    });
    const admission = packetAdmissionGuard.evaluate(input.packet);

    if (!admission.admitted) {
      return denied("packet_admission", admission.reason, admission.errors, {
        packetAdmitted: false,
        missionAllowed: false,
        safetyAllowed: false,
        boardAllowed: false,
        fixedSafeMessage: admission.fixedSafeMessage,
      });
    }

    const packet = input.packet as RoverPacket;

    if (admission.fixedSafeMessage) {
      return {
        authorized: true,
        reason: "fixed_safe_message_authorized",
        errors: [],
        stage: "authorized",
        packetAdmitted: true,
        missionAllowed: true,
        safetyAllowed: true,
        boardAllowed: true,
        fixedSafeMessage: true,
      };
    }

    const mission = new MissionProfileGuard(input.missionProfile).evaluate({
      packet,
      origin: input.origin,
      mode: input.mode,
    });
    if (!mission.allowed) {
      return denied("mission_profile", mission.reason, mission.errors, {
        packetAdmitted: true,
        missionAllowed: false,
        safetyAllowed: false,
        boardAllowed: false,
        fixedSafeMessage: false,
      });
    }

    const safety = new SafetyPolicyGuard(input.safetyPolicy).evaluate({
      packet,
      mode: input.mode,
    });
    if (!safety.allowed) {
      return denied("safety_policy", safety.reason, safety.errors, {
        packetAdmitted: true,
        missionAllowed: true,
        safetyAllowed: false,
        boardAllowed: false,
        fixedSafeMessage: false,
      });
    }

    const board = new BoardProfileGuard(input.boardProfile).evaluate({
      packet,
      mode: input.mode,
    });
    if (!board.allowed) {
      return denied("board_profile", board.reason, board.errors, {
        packetAdmitted: true,
        missionAllowed: true,
        safetyAllowed: true,
        boardAllowed: false,
        fixedSafeMessage: false,
      });
    }

    return {
      authorized: true,
      reason: "authorized",
      errors: [],
      stage: "authorized",
      packetAdmitted: true,
      missionAllowed: true,
      safetyAllowed: true,
      boardAllowed: true,
      fixedSafeMessage: false,
    };
  }
}

function denied(
  stage: CommandAuthorizationStage,
  reason: string,
  errors: string[],
  flags: Pick<
    CommandAuthorizationResult,
    | "packetAdmitted"
    | "missionAllowed"
    | "safetyAllowed"
    | "boardAllowed"
    | "fixedSafeMessage"
  >,
): CommandAuthorizationResult {
  return {
    authorized: false,
    reason,
    errors,
    stage,
    ...flags,
  };
}
