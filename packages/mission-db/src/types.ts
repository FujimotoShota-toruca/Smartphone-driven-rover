export type MissionDbRecord = Record<string, unknown>;

export interface CommandsDefinition {
  schema_version: number;
  commands: Record<string, MissionDbRecord>;
}

export interface TelemetryDefinition {
  schema_version: number;
  telemetry: Record<string, MissionDbRecord>;
}

export interface SafetyDefinition {
  schema_version: number;
  fixed_safety_kernel: MissionDbRecord;
  policy_defaults: MissionDbRecord;
}

export interface MissionProfile {
  name: string;
  enabled_capabilities?: string[];
  policy?: MissionProfilePolicy;
  [key: string]: unknown;
}

export interface MissionProfilePolicy extends MissionDbRecord {
  manual_override_allowed?: boolean;
  remote_manual_cmd_allowed?: boolean;
  remote_uplink_allowed?: boolean;
}

export interface MissionProfileDefinition {
  schema_version: number;
  mission_profile: MissionProfile;
}

export interface BoardProfile {
  name: string;
  capabilities?: Record<string, boolean>;
  pins?: Record<string, string>;
  [key: string]: unknown;
}

export interface BoardProfileDefinition {
  schema_version: number;
  board_profile: BoardProfile;
}

export interface MissionDb {
  commands: CommandsDefinition;
  telemetry: TelemetryDefinition;
  safety: SafetyDefinition;
  missionProfiles: MissionProfileDefinition[];
  boardProfiles: BoardProfileDefinition[];
}

export type MissionDbInput =
  | MissionDb
  | CommandsDefinition
  | TelemetryDefinition
  | SafetyDefinition
  | MissionProfileDefinition
  | BoardProfileDefinition
  | MissionDbInput[]
  | MissionDbRecord;

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface MissionDbHashes {
  core_protocol_hash: string;
  mission_db_hash: string;
  board_profile_hash: string;
}
