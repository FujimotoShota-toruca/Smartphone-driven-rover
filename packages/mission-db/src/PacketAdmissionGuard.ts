import { PacketEnvelopeValidator } from "../../protocol/src/PacketEnvelopeValidator";
import type { RoverPacket } from "../../protocol/src/types";

import { CommandRegistry } from "./CommandRegistry";
import { SchemaHashGuard } from "./SchemaHashGuard";

export interface PacketAdmissionResult {
  admitted: boolean;
  reason: string;
  errors: string[];
  envelopeValid: boolean;
  knownMessage: boolean;
  knownCommand: boolean;
  knownTelemetry: boolean;
  hashMatched: boolean;
  fixedSafeMessage: boolean;
}

export class PacketAdmissionGuard {
  readonly #envelopeValidator: PacketEnvelopeValidator;
  readonly #registry: CommandRegistry;
  readonly #schemaHashGuard: SchemaHashGuard;

  public constructor(options: {
    registry: CommandRegistry;
    schemaHashGuard: SchemaHashGuard;
    envelopeValidator?: PacketEnvelopeValidator;
  }) {
    this.#registry = options.registry;
    this.#schemaHashGuard = options.schemaHashGuard;
    this.#envelopeValidator =
      options.envelopeValidator ?? new PacketEnvelopeValidator();
  }

  public evaluate(packet: unknown): PacketAdmissionResult {
    const envelopeResult = this.#envelopeValidator.validate(packet);

    if (!envelopeResult.valid) {
      return {
        admitted: false,
        reason: "invalid_envelope",
        errors: envelopeResult.errors.map(
          (error) => `${error.path}: ${error.message}`,
        ),
        envelopeValid: false,
        knownMessage: false,
        knownCommand: false,
        knownTelemetry: false,
        hashMatched: false,
        fixedSafeMessage: envelopeResult.isFixedSafeMessage,
      };
    }

    const roverPacket = packet as RoverPacket;
    const knownCommand = this.#registry.isKnownCommand(roverPacket.msg_type);
    const knownTelemetry = this.#registry.isKnownTelemetry(roverPacket.msg_type);
    const guardResult = this.#schemaHashGuard.evaluate(roverPacket);

    return {
      admitted: guardResult.allowed,
      reason: guardResult.reason,
      errors: guardResult.errors,
      envelopeValid: true,
      knownMessage: guardResult.knownMessage,
      knownCommand,
      knownTelemetry,
      hashMatched: guardResult.hashMatched,
      fixedSafeMessage: guardResult.fixedSafeMessage,
    };
  }
}
