import type {
  CommandsDefinition,
  MissionDb,
  MissionDbRecord,
  TelemetryDefinition,
} from "./types";

export class CommandRegistry {
  readonly #commands: Set<string>;
  readonly #telemetry: Set<string>;

  public constructor(options?: {
    commands?: Iterable<string>;
    telemetry?: Iterable<string>;
  }) {
    this.#commands = new Set(options?.commands ?? []);
    this.#telemetry = new Set(options?.telemetry ?? []);
  }

  public static fromMissionDb(missionDb: MissionDb): CommandRegistry {
    return CommandRegistry.fromDefinitions(
      missionDb.commands,
      missionDb.telemetry,
    );
  }

  public static fromDefinitions(
    commands: CommandsDefinition,
    telemetry: TelemetryDefinition,
  ): CommandRegistry {
    return new CommandRegistry({
      commands: collectMessageTypes(commands.commands),
      telemetry: collectMessageTypes(telemetry.telemetry),
    });
  }

  public isKnownCommand(msgType: string): boolean {
    return this.#commands.has(msgType);
  }

  public isKnownTelemetry(msgType: string): boolean {
    return this.#telemetry.has(msgType);
  }

  public isKnownMessage(msgType: string): boolean {
    return this.isKnownCommand(msgType) || this.isKnownTelemetry(msgType);
  }

  public get commandTypes(): string[] {
    return [...this.#commands].sort();
  }

  public get telemetryTypes(): string[] {
    return [...this.#telemetry].sort();
  }
}

function collectMessageTypes(
  definitions: Record<string, MissionDbRecord>,
): string[] {
  const messageTypes = new Set<string>();

  for (const [name, definition] of Object.entries(definitions)) {
    addIfNonEmptyString(messageTypes, name);
    addIfNonEmptyString(messageTypes, definition.name);
    addIfNonEmptyString(messageTypes, definition.msg_type);
  }

  return [...messageTypes];
}

function addIfNonEmptyString(target: Set<string>, value: unknown): void {
  if (typeof value === "string" && value.length > 0) {
    target.add(value);
  }
}
