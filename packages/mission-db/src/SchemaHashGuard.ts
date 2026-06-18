import type { RoverPacket } from "../../protocol/src/types";
import { isFixedSafeMessage } from "../../protocol/src/validation";

import { CommandRegistry } from "./CommandRegistry";
import type { MissionDbHashes } from "./types";

export interface SchemaHashGuardResult {
  allowed: boolean;
  reason: string;
  errors: string[];
  hashMatched: boolean;
  fixedSafeMessage: boolean;
  knownMessage: boolean;
}

export class SchemaHashGuard {
  readonly #currentHashes: MissionDbHashes;
  readonly #registry?: CommandRegistry;

  public constructor(
    currentHashes: MissionDbHashes,
    registry?: CommandRegistry,
  ) {
    this.#currentHashes = currentHashes;
    this.#registry = registry;
  }

  public evaluate(packet: RoverPacket): SchemaHashGuardResult {
    const errors = this.#collectHashErrors(packet);
    const hashMatched = errors.length === 0;
    const fixedSafeMessage = isFixedSafeMessage(packet.msg_type);
    const knownMessage =
      fixedSafeMessage ||
      this.#registry?.isKnownMessage(packet.msg_type) ||
      false;

    if (!knownMessage) {
      return {
        allowed: false,
        reason: "unknown_msg_type",
        errors: [`unknown msg_type: ${packet.msg_type}`],
        hashMatched,
        fixedSafeMessage,
        knownMessage,
      };
    }

    if (hashMatched) {
      return {
        allowed: true,
        reason: "hash_matched",
        errors: [],
        hashMatched,
        fixedSafeMessage,
        knownMessage,
      };
    }

    if (fixedSafeMessage) {
      return {
        allowed: true,
        reason: "fixed_safe_message_hash_mismatch_allowed",
        errors,
        hashMatched,
        fixedSafeMessage,
        knownMessage,
      };
    }

    return {
      allowed: false,
      reason: "schema_hash_mismatch",
      errors,
      hashMatched,
      fixedSafeMessage,
      knownMessage,
    };
  }

  #collectHashErrors(packet: RoverPacket): string[] {
    const errors: string[] = [];

    collectHashError(
      errors,
      "core_protocol_hash",
      packet.schema.core_protocol_hash,
      this.#currentHashes.core_protocol_hash,
    );
    collectHashError(
      errors,
      "mission_db_hash",
      packet.schema.mission_db_hash,
      this.#currentHashes.mission_db_hash,
    );
    collectHashError(
      errors,
      "board_profile_hash",
      packet.schema.board_profile_hash,
      this.#currentHashes.board_profile_hash,
    );

    return errors;
  }
}

function collectHashError(
  errors: string[],
  field: keyof MissionDbHashes,
  actual: string,
  expected: string,
): void {
  if (actual !== expected) {
    errors.push(`${field} mismatch`);
  }
}
