import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  loadBoardProfiles,
  loadMissionDb,
  loadMissionProfiles,
} from "../src/loadMissionDb";
import {
  validateCommandsDefinition,
  validateMissionDb,
  validateSafetyDefinition,
} from "../src/validateMissionDb";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

describe("loadMissionDb and validateMissionDb", () => {
  it("loads and validates the repository Mission Database YAML files", async () => {
    const missionDb = await loadMissionDb(repoRoot);
    const result = validateMissionDb(missionDb);

    expect(result).toEqual({ valid: true, errors: [] });
    expect(Object.keys(missionDb.commands.commands)).toContain("cmd_vel");
    expect(Object.keys(missionDb.telemetry.telemetry)).toContain("pico_hk");
    expect(missionDb.missionProfiles.map((item) => item.mission_profile.name))
      .toContain("engineering_rover_demo");
    expect(missionDb.boardProfiles.map((item) => item.board_profile.name))
      .toContain("minimal_2wheel_pico_board");
  });

  it("loads mission profiles and board profiles independently", async () => {
    const missionProfiles = await loadMissionProfiles(
      path.join(repoRoot, "mission", "missions"),
    );
    const boardProfiles = await loadBoardProfiles(
      path.join(repoRoot, "mission", "boards"),
    );

    expect(missionProfiles.length).toBeGreaterThan(0);
    expect(boardProfiles.length).toBeGreaterThan(0);
    expect(missionProfiles.every((item) => item.mission_profile.name)).toBe(
      true,
    );
    expect(boardProfiles.every((item) => item.board_profile.name)).toBe(true);
  });

  it("rejects commands definitions missing the commands object", () => {
    const result = validateCommandsDefinition({ schema_version: 1 });

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ path: "commandsDefinition.commands" }),
    );
  });

  it("rejects command entries that do not have a usable map name", () => {
    const result = validateCommandsDefinition({
      schema_version: 1,
      commands: {
        "": {},
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        path: "commandsDefinition.commands",
      }),
    );
  });

  it("rejects safety definitions missing fixed_safety_kernel", () => {
    const result = validateSafetyDefinition({
      schema_version: 1,
      policy_defaults: {},
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        path: "safetyDefinition.fixed_safety_kernel",
      }),
    );
  });
});
