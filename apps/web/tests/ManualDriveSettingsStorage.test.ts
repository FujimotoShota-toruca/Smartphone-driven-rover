import { describe, expect, it } from "vitest";

import {
  loadManualDriveSettings,
  manualDriveSettingsKeys,
  saveButtonAssignments,
  savePwmPercent,
} from "../src/manual/ManualDriveSettingsStorage";

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("ManualDriveSettingsStorage", () => {
  it("saves and restores PWM percentages", () => {
    const storage = new MemoryStorage();

    savePwmPercent(storage, manualDriveSettingsKeys.leftPwmPercent, 35);
    savePwmPercent(storage, manualDriveSettingsKeys.rightPwmPercent, 80);

    expect(loadManualDriveSettings(storage)).toMatchObject({
      leftPwmPercent: 35,
      rightPwmPercent: 80,
    });
  });

  it("falls back to defaults for invalid PWM values", () => {
    const storage = new MemoryStorage();
    storage.setItem(manualDriveSettingsKeys.leftPwmPercent, "101");
    storage.setItem(manualDriveSettingsKeys.rightPwmPercent, "broken");

    expect(loadManualDriveSettings(storage)).toMatchObject({
      leftPwmPercent: 50,
      rightPwmPercent: 50,
    });
  });

  it("saves and restores button assignments", () => {
    const storage = new MemoryStorage();

    saveButtonAssignments(storage, {
      forward: "back",
      back: "forward",
      left: "right",
      right: "left",
    });

    expect(loadManualDriveSettings(storage).buttonAssignments).toEqual({
      forward: "back",
      back: "forward",
      left: "right",
      right: "left",
    });
  });

  it("falls back per button for corrupted assignments", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      manualDriveSettingsKeys.buttonAssignments,
      JSON.stringify({
        forward: "back",
        back: "invalid",
        left: 100,
      }),
    );

    expect(loadManualDriveSettings(storage).buttonAssignments).toEqual({
      forward: "back",
      back: "back",
      left: "left",
      right: "right",
    });
  });
});
