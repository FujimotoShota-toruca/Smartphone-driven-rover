import { describe, expect, it } from "vitest";

import { manualDriveCommands } from "../src/manual/manualDriveCommands";

describe("manualDriveCommands", () => {
  it("uses Lv1 normalized open-loop duty commands", () => {
    expect(manualDriveCommands.forward).toEqual({ vx: 1, wz: 0, brake: false });
    expect(manualDriveCommands.back).toEqual({ vx: -1, wz: 0, brake: false });
    expect(manualDriveCommands.left).toEqual({ vx: 0, wz: -1, brake: false });
    expect(manualDriveCommands.right).toEqual({ vx: 0, wz: 1, brake: false });
    expect(manualDriveCommands.stop).toEqual({ vx: 0, wz: 0, brake: true });
    expect(manualDriveCommands.neutral).toEqual({ vx: 0, wz: 0, brake: true });
  });
});
