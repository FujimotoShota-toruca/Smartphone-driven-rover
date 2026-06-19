import type { ManualCommand } from "./ManualCommandRepeater";

export const manualDriveCommands = {
  forward: { vx: 1.0, wz: 0.0, brake: false },
  back: { vx: -1.0, wz: 0.0, brake: false },
  left: { vx: 0.0, wz: -1.0, brake: false },
  right: { vx: 0.0, wz: 1.0, brake: false },
  stop: { vx: 0.0, wz: 0.0, brake: true },
  neutral: { vx: 0.0, wz: 0.0, brake: true },
} satisfies Record<string, ManualCommand>;
