import { createHash } from "node:crypto";

import { canonicalJson } from "./canonicalJson";
import type {
  BoardProfileDefinition,
  MissionDb,
  MissionDbHashes,
  MissionDbInput,
} from "./types";

export function sha256CanonicalJson(value: MissionDbInput): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function hashMissionDb(missionDb: MissionDb): MissionDbHashes {
  return {
    core_protocol_hash: sha256CanonicalJson({
      commands: missionDb.commands,
      telemetry: missionDb.telemetry,
      safety: missionDb.safety,
    }),
    mission_db_hash: sha256CanonicalJson({
      commands: missionDb.commands,
      telemetry: missionDb.telemetry,
      safety: missionDb.safety,
      missionProfiles: missionDb.missionProfiles,
      boardProfiles: missionDb.boardProfiles,
    }),
    board_profile_hash: sha256CanonicalJson(
      normalizeBoardProfiles(missionDb.boardProfiles),
    ),
  };
}

function normalizeBoardProfiles(
  boardProfiles: BoardProfileDefinition[],
): BoardProfileDefinition[] {
  return [...boardProfiles].sort((left, right) =>
    left.board_profile.name.localeCompare(right.board_profile.name),
  );
}
