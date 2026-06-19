import { describe, expect, it } from "vitest";

import {
  DEFAULT_MANUAL_PWM_PERCENT,
  RIGHT_PWM_MIN_EFFECTIVE_DUTY,
  createManualDriveCommand,
  defaultManualButtonAssignments,
  manualDriveCommands,
  manualDriveCommandCodes,
  manualDriveDirections,
  manualPwmToCompatCmdVel,
  normalizePwmPercent,
  normalizeRightPwmPercent,
} from "../src/manual/manualDriveCommands";

describe("manualDriveCommands", () => {
  it("uses default 50 percent Lv1 manual PWM commands", () => {
    expect(DEFAULT_MANUAL_PWM_PERCENT).toBe(50);
    expect(manualDriveDirections).toEqual(["forward", "back", "left", "right"]);
    expect(defaultManualButtonAssignments).toEqual({
      forward: "forward",
      back: "back",
      left: "left",
      right: "right",
    });
    expect(manualDriveCommandCodes).toEqual({
      forward: "1010",
      back: "0101",
      left: "0110",
      right: "1001",
    });
    expect(manualDriveCommands.forward).toEqual({ leftPwm: 0.75, rightPwm: -0.5, brake: false });
    expect(manualDriveCommands.back).toEqual({ leftPwm: -0.75, rightPwm: 0.5, brake: false });
    expect(manualDriveCommands.left).toEqual({ leftPwm: 0.75, rightPwm: 0.5, brake: false });
    expect(manualDriveCommands.right).toEqual({ leftPwm: -0.75, rightPwm: -0.5, brake: false });
    expect(manualDriveCommands.stop).toEqual({ leftPwm: 0, rightPwm: 0, brake: true });
    expect(manualDriveCommands.neutral).toEqual({
      leftPwm: 0,
      rightPwm: 0,
      brake: false,
      coast: true,
    });
  });

  it("normalizes UI slider percentages into 0.0 to 1.0 output strength", () => {
    expect(normalizePwmPercent(-150)).toBe(0);
    expect(normalizePwmPercent(0)).toBe(0);
    expect(normalizePwmPercent(50)).toBe(0.5);
    expect(normalizePwmPercent(150)).toBe(1);
  });

  it("applies right-side minimum effective duty while preserving zero", () => {
    expect(RIGHT_PWM_MIN_EFFECTIVE_DUTY).toBe(0.5);
    expect(normalizeRightPwmPercent(0)).toBe(0);
    expect(normalizeRightPwmPercent(50)).toBe(0.75);
    expect(normalizeRightPwmPercent(100)).toBe(1);
  });

  it("maps UI direction to the current wiring correction", () => {
    expect(createManualDriveCommand("forward", 80, 60)).toEqual({
      leftPwm: 0.8,
      rightPwm: -0.8,
      brake: false,
    });
    expect(createManualDriveCommand("right", 80, 60)).toEqual({
      leftPwm: -0.8,
      rightPwm: -0.8,
      brake: false,
    });
  });

  it("keeps vx/wz compatibility values for existing cmd_vel envelope", () => {
    expect(manualPwmToCompatCmdVel(manualDriveCommands.forward)).toEqual({
      vx: 0.125,
      wz: -0.625,
    });
    expect(manualPwmToCompatCmdVel(manualDriveCommands.left)).toEqual({
      vx: 0.625,
      wz: -0.125,
    });
  });
});
