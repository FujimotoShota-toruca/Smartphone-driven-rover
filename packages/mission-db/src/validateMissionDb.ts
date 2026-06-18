import type { MissionDb, ValidationError, ValidationResult } from "./types";

export function validateMissionDb(missionDb: MissionDb): ValidationResult {
  return combineValidationResults(
    validateCommandsDefinition(missionDb.commands, "commands"),
    validateTelemetryDefinition(missionDb.telemetry, "telemetry"),
    validateSafetyDefinition(missionDb.safety, "safety"),
    ...missionDb.missionProfiles.map((profile, index) =>
      validateMissionProfileDefinition(
        profile,
        `missionProfiles.${index}`,
      ),
    ),
    ...missionDb.boardProfiles.map((profile, index) =>
      validateBoardProfileDefinition(profile, `boardProfiles.${index}`),
    ),
  );
}

export function validateCommandsDefinition(
  value: unknown,
  path = "commandsDefinition",
): ValidationResult {
  const errors: ValidationError[] = [];

  validateSchemaVersion(value, path, errors);
  const commands = readRecordProperty(value, "commands", path, errors);
  if (commands) {
    validateNamedDefinitionMap(commands, `${path}.commands`, errors);
  }

  return toValidationResult(errors);
}

export function validateTelemetryDefinition(
  value: unknown,
  path = "telemetryDefinition",
): ValidationResult {
  const errors: ValidationError[] = [];

  validateSchemaVersion(value, path, errors);
  const telemetry = readRecordProperty(value, "telemetry", path, errors);
  if (telemetry) {
    validateNamedDefinitionMap(telemetry, `${path}.telemetry`, errors);
  }

  return toValidationResult(errors);
}

export function validateSafetyDefinition(
  value: unknown,
  path = "safetyDefinition",
): ValidationResult {
  const errors: ValidationError[] = [];

  validateSchemaVersion(value, path, errors);
  readRecordProperty(value, "fixed_safety_kernel", path, errors);
  readRecordProperty(value, "policy_defaults", path, errors);

  return toValidationResult(errors);
}

export function validateMissionProfileDefinition(
  value: unknown,
  path = "missionProfileDefinition",
): ValidationResult {
  const errors: ValidationError[] = [];

  validateSchemaVersion(value, path, errors);
  const missionProfile = readRecordProperty(
    value,
    "mission_profile",
    path,
    errors,
  );
  if (missionProfile) {
    validateNonEmptyStringProperty(
      missionProfile,
      "name",
      `${path}.mission_profile`,
      errors,
    );
  }

  return toValidationResult(errors);
}

export function validateBoardProfileDefinition(
  value: unknown,
  path = "boardProfileDefinition",
): ValidationResult {
  const errors: ValidationError[] = [];

  validateSchemaVersion(value, path, errors);
  const boardProfile = readRecordProperty(
    value,
    "board_profile",
    path,
    errors,
  );
  if (boardProfile) {
    validateNonEmptyStringProperty(
      boardProfile,
      "name",
      `${path}.board_profile`,
      errors,
    );
  }

  return toValidationResult(errors);
}

function combineValidationResults(
  ...results: ValidationResult[]
): ValidationResult {
  return toValidationResult(results.flatMap((result) => result.errors));
}

function validateSchemaVersion(
  value: unknown,
  path: string,
  errors: ValidationError[],
): void {
  if (!isRecord(value)) {
    errors.push({
      path,
      message: `${path} must be an object`,
    });
    return;
  }

  if (!hasOwn(value, "schema_version")) {
    errors.push({
      path: `${path}.schema_version`,
      message: `${path}.schema_version is required`,
    });
    return;
  }

  const schemaVersion = value.schema_version;
  if (
    typeof schemaVersion !== "number" ||
    !Number.isSafeInteger(schemaVersion) ||
    schemaVersion < 0
  ) {
    errors.push({
      path: `${path}.schema_version`,
      message: `${path}.schema_version must be a non-negative integer`,
    });
  }
}

function readRecordProperty(
  value: unknown,
  property: string,
  path: string,
  errors: ValidationError[],
): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const propertyPath = `${path}.${property}`;
  if (!hasOwn(value, property)) {
    errors.push({
      path: propertyPath,
      message: `${propertyPath} is required`,
    });
    return undefined;
  }

  const propertyValue = value[property];
  if (!isRecord(propertyValue)) {
    errors.push({
      path: propertyPath,
      message: `${propertyPath} must be an object`,
    });
    return undefined;
  }

  return propertyValue;
}

function validateNamedDefinitionMap(
  value: Record<string, unknown>,
  path: string,
  errors: ValidationError[],
): void {
  const entries = Object.entries(value);
  if (entries.length === 0) {
    errors.push({
      path,
      message: `${path} must contain at least one definition`,
    });
    return;
  }

  for (const [name, definition] of entries) {
    if (name.length === 0) {
      errors.push({
        path,
        message: `${path} contains an empty definition name`,
      });
    }

    if (!isRecord(definition)) {
      errors.push({
        path: `${path}.${name}`,
        message: `${path}.${name} must be an object`,
      });
    }
  }
}

function validateNonEmptyStringProperty(
  value: Record<string, unknown>,
  property: string,
  path: string,
  errors: ValidationError[],
): void {
  const propertyPath = `${path}.${property}`;
  if (!hasOwn(value, property)) {
    errors.push({
      path: propertyPath,
      message: `${propertyPath} is required`,
    });
    return;
  }

  if (typeof value[property] !== "string" || value[property].length === 0) {
    errors.push({
      path: propertyPath,
      message: `${propertyPath} must be a non-empty string`,
    });
  }
}

function toValidationResult(errors: ValidationError[]): ValidationResult {
  return {
    valid: errors.length === 0,
    errors,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, property: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, property);
}
