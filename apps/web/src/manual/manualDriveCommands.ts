export interface ManualPwmCommand {
  leftPwm: number;
  rightPwm: number;
  brake: boolean;
  coast?: boolean;
}

export const manualDriveDirections = ["forward", "back", "left", "right"] as const;
export type ManualDriveDirection = (typeof manualDriveDirections)[number];
export type ManualButtonAssignments = Record<ManualDriveDirection, ManualDriveDirection>;
export type ManualDriveCommandCodeMap = Record<ManualDriveDirection, string>;

export const DEFAULT_MANUAL_PWM_PERCENT = 50;
export const RIGHT_PWM_MIN_EFFECTIVE_DUTY = 0.5;
export const defaultManualButtonAssignments: ManualButtonAssignments = {
  forward: "forward",
  back: "back",
  left: "left",
  right: "right",
};
export const manualDriveCommandCodes: ManualDriveCommandCodeMap = {
  forward: "1010",
  back: "0101",
  left: "0110",
  right: "1001",
};

export const manualDriveCommands = {
  forward: createManualDriveCommand("forward"),
  back: createManualDriveCommand("back"),
  left: createManualDriveCommand("left"),
  right: createManualDriveCommand("right"),
  stop: { leftPwm: 0.0, rightPwm: 0.0, brake: true },
  neutral: { leftPwm: 0.0, rightPwm: 0.0, brake: false, coast: true },
} satisfies Record<string, ManualPwmCommand>;

export function normalizePwmPercent(percent: number): number {
  if (percent < 0) {
    return 0;
  }
  if (percent > 100) {
    return 1;
  }
  return percent / 100;
}

export function createManualDriveCommand(
  direction: ManualDriveDirection,
  leftPercent = DEFAULT_MANUAL_PWM_PERCENT,
  rightPercent = DEFAULT_MANUAL_PWM_PERCENT,
): ManualPwmCommand {
  const leftPower = normalizePwmPercent(leftPercent);
  const rightPower = normalizeRightPwmPercent(rightPercent);

  switch (direction) {
    case "forward":
      return applyCurrentWiringMap(leftPower, rightPower);
    case "back":
      return applyCurrentWiringMap(-leftPower, -rightPower);
    case "left":
      return applyCurrentWiringMap(-leftPower, rightPower);
    case "right":
      return applyCurrentWiringMap(leftPower, -rightPower);
  }
}

function applyCurrentWiringMap(logicalLeft: number, logicalRight: number): ManualPwmCommand {
  return {
    leftPwm: logicalRight,
    rightPwm: -logicalLeft,
    brake: false,
  };
}

export function normalizeRightPwmPercent(percent: number): number {
  const normalized = normalizePwmPercent(percent);
  if (normalized === 0) {
    return 0;
  }
  return RIGHT_PWM_MIN_EFFECTIVE_DUTY + normalized * (1 - RIGHT_PWM_MIN_EFFECTIVE_DUTY);
}

export function manualPwmToCompatCmdVel(command: ManualPwmCommand): {
  vx: number;
  wz: number;
} {
  return {
    vx: (command.leftPwm + command.rightPwm) / 2,
    wz: (command.rightPwm - command.leftPwm) / 2,
  };
}
