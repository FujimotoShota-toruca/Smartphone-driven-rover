import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { CommandRegistry } from "../src/CommandRegistry";
import { loadMissionDb } from "../src/loadMissionDb";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

describe("CommandRegistry", () => {
  it("identifies known commands and telemetry from repository Mission DB", async () => {
    const missionDb = await loadMissionDb(repoRoot);
    const registry = CommandRegistry.fromMissionDb(missionDb);

    expect(registry.isKnownCommand("cmd_vel")).toBe(true);
    expect(registry.isKnownTelemetry("pico_hk")).toBe(true);
    expect(registry.isKnownMessage("cmd_vel")).toBe(true);
    expect(registry.isKnownMessage("pico_hk")).toBe(true);
  });

  it("detects unknown msg_type values", async () => {
    const missionDb = await loadMissionDb(repoRoot);
    const registry = CommandRegistry.fromMissionDb(missionDb);

    expect(registry.isKnownCommand("not_defined")).toBe(false);
    expect(registry.isKnownTelemetry("not_defined")).toBe(false);
    expect(registry.isKnownMessage("not_defined")).toBe(false);
  });

  it("registers explicit msg_type or name fields when present", () => {
    const registry = CommandRegistry.fromDefinitions(
      {
        schema_version: 1,
        commands: {
          map_key_command: {
            msg_type: "explicit_command",
          },
          another_key: {
            name: "named_command",
          },
        },
      },
      {
        schema_version: 1,
        telemetry: {
          map_key_telemetry: {
            msg_type: "explicit_telemetry",
          },
        },
      },
    );

    expect(registry.isKnownCommand("map_key_command")).toBe(true);
    expect(registry.isKnownCommand("explicit_command")).toBe(true);
    expect(registry.isKnownCommand("named_command")).toBe(true);
    expect(registry.isKnownTelemetry("map_key_telemetry")).toBe(true);
    expect(registry.isKnownTelemetry("explicit_telemetry")).toBe(true);
  });
});
