import {
  DEFAULT_MANUAL_PWM_PERCENT,
  defaultManualButtonAssignments,
  manualDriveDirections,
  type ManualButtonAssignments,
  type ManualDriveDirection,
} from "./manualDriveCommands";

export interface ManualDriveSettings {
  leftPwmPercent: number;
  rightPwmPercent: number;
  buttonAssignments: ManualButtonAssignments;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const manualDriveSettingsKeys = {
  leftPwmPercent: "left_pwm_percent",
  rightPwmPercent: "right_pwm_percent",
  buttonAssignments: "manual_button_assignments",
} as const;

export function loadManualDriveSettings(
  storage: StorageLike | undefined = browserLocalStorage(),
): ManualDriveSettings {
  return {
    leftPwmPercent: loadPwmPercent(
      storage,
      manualDriveSettingsKeys.leftPwmPercent,
    ),
    rightPwmPercent: loadPwmPercent(
      storage,
      manualDriveSettingsKeys.rightPwmPercent,
    ),
    buttonAssignments: loadButtonAssignments(storage),
  };
}

export function savePwmPercent(
  storage: StorageLike | undefined = browserLocalStorage(),
  key: typeof manualDriveSettingsKeys.leftPwmPercent | typeof manualDriveSettingsKeys.rightPwmPercent,
  value: number,
): void {
  if (!storage) {
    return;
  }

  const safeValue = sanitizePwmPercent(value);
  try {
    storage.setItem(key, String(safeValue));
  } catch {
    // Browser storage may be disabled. UI can continue with in-memory state.
  }
}

export function saveButtonAssignments(
  storage: StorageLike | undefined = browserLocalStorage(),
  assignments: ManualButtonAssignments,
): void {
  if (!storage) {
    return;
  }

  const safeAssignments = sanitizeButtonAssignments(assignments);
  try {
    storage.setItem(
      manualDriveSettingsKeys.buttonAssignments,
      JSON.stringify(safeAssignments),
    );
  } catch {
    // Browser storage may be disabled. UI can continue with in-memory state.
  }
}

export function sanitizePwmPercent(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return DEFAULT_MANUAL_PWM_PERCENT;
  }
  if (value < 0 || value > 100) {
    return DEFAULT_MANUAL_PWM_PERCENT;
  }
  return value;
}

export function sanitizeButtonAssignments(
  value: unknown,
): ManualButtonAssignments {
  if (!isRecord(value)) {
    return { ...defaultManualButtonAssignments };
  }

  const assignments: Partial<ManualButtonAssignments> = {};
  for (const button of manualDriveDirections) {
    const direction = value[button];
    assignments[button] = isManualDriveDirection(direction)
      ? direction
      : defaultManualButtonAssignments[button];
  }

  return assignments as ManualButtonAssignments;
}

function loadPwmPercent(
  storage: StorageLike | undefined,
  key: typeof manualDriveSettingsKeys.leftPwmPercent | typeof manualDriveSettingsKeys.rightPwmPercent,
): number {
  if (!storage) {
    return DEFAULT_MANUAL_PWM_PERCENT;
  }

  try {
    const value = storage.getItem(key);
    if (value === null) {
      return DEFAULT_MANUAL_PWM_PERCENT;
    }
    return sanitizePwmPercent(Number(value));
  } catch {
    return DEFAULT_MANUAL_PWM_PERCENT;
  }
}

function loadButtonAssignments(
  storage: StorageLike | undefined,
): ManualButtonAssignments {
  if (!storage) {
    return { ...defaultManualButtonAssignments };
  }

  try {
    const value = storage.getItem(manualDriveSettingsKeys.buttonAssignments);
    if (value === null) {
      return { ...defaultManualButtonAssignments };
    }
    return sanitizeButtonAssignments(JSON.parse(value));
  } catch {
    return { ...defaultManualButtonAssignments };
  }
}

function isManualDriveDirection(value: unknown): value is ManualDriveDirection {
  return typeof value === "string" && manualDriveDirections.includes(value as ManualDriveDirection);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function browserLocalStorage(): StorageLike | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return window.localStorage;
}
