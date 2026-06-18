import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import yaml from "js-yaml";

import type {
  BoardProfileDefinition,
  CommandsDefinition,
  MissionDb,
  MissionProfileDefinition,
  SafetyDefinition,
  TelemetryDefinition,
} from "./types";

export async function loadYamlFile<T = unknown>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf8");
  return yaml.load(content) as T;
}

export async function loadMissionDb(rootDir: string): Promise<MissionDb> {
  const missionDir = path.join(rootDir, "mission");
  const [commands, telemetry, safety, missionProfiles, boardProfiles] =
    await Promise.all([
      loadYamlFile<CommandsDefinition>(
        path.join(missionDir, "core", "commands.yaml"),
      ),
      loadYamlFile<TelemetryDefinition>(
        path.join(missionDir, "core", "telemetry.yaml"),
      ),
      loadYamlFile<SafetyDefinition>(
        path.join(missionDir, "core", "safety.yaml"),
      ),
      loadMissionProfiles(path.join(missionDir, "missions")),
      loadBoardProfiles(path.join(missionDir, "boards")),
    ]);

  return {
    commands,
    telemetry,
    safety,
    missionProfiles,
    boardProfiles,
  };
}

export async function loadMissionProfiles(
  profilesDir: string,
): Promise<MissionProfileDefinition[]> {
  return loadYamlFilesFromDirectory<MissionProfileDefinition>(profilesDir);
}

export async function loadBoardProfiles(
  boardsDir: string,
): Promise<BoardProfileDefinition[]> {
  return loadYamlFilesFromDirectory<BoardProfileDefinition>(boardsDir);
}

async function loadYamlFilesFromDirectory<T>(directory: string): Promise<T[]> {
  const fileNames = (await readdir(directory))
    .filter((fileName) => fileName.endsWith(".yaml"))
    .sort((a, b) => a.localeCompare(b));

  return Promise.all(
    fileNames.map((fileName) => loadYamlFile<T>(path.join(directory, fileName))),
  );
}
