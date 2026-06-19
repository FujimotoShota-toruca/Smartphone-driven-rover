import { afterEach, describe, expect, it, vi } from "vitest";

import { ManualCommandRepeater } from "../src/manual/ManualCommandRepeater";

describe("ManualCommandRepeater", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts sending on pointerdown-equivalent start and repeats while active", () => {
    vi.useFakeTimers();
    const sendCommand = vi.fn();
    const sendStop = vi.fn();
    const repeater = new ManualCommandRepeater({
      intervalMs: 120,
      sendCommand,
      sendStop,
    });

    repeater.start({ vx: 0.3, wz: 0 });
    expect(sendCommand).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(240);
    expect(sendCommand).toHaveBeenCalledTimes(3);
    expect(sendStop).not.toHaveBeenCalled();
  });

  it("stops repeating and sends one stop command on pointerup-equivalent stop", () => {
    vi.useFakeTimers();
    const sendCommand = vi.fn();
    const sendStop = vi.fn();
    const repeater = new ManualCommandRepeater({
      intervalMs: 120,
      sendCommand,
      sendStop,
    });

    repeater.start({ vx: 0.3, wz: 0 });
    repeater.stopAndSendStop();
    vi.advanceTimersByTime(240);

    expect(sendCommand).toHaveBeenCalledTimes(1);
    expect(sendStop).toHaveBeenCalledTimes(1);
    expect(repeater.isRunning()).toBe(false);
  });

  it("disconnect-equivalent cancel stops repeats without sending a stale stop", () => {
    vi.useFakeTimers();
    const sendCommand = vi.fn();
    const sendStop = vi.fn();
    const repeater = new ManualCommandRepeater({
      intervalMs: 120,
      sendCommand,
      sendStop,
    });

    repeater.start({ vx: 0, wz: -0.5 });
    repeater.cancel();
    vi.advanceTimersByTime(240);

    expect(sendCommand).toHaveBeenCalledTimes(1);
    expect(sendStop).not.toHaveBeenCalled();
    expect(repeater.isRunning()).toBe(false);
  });

  it("E-stop-equivalent cancel stops repeats immediately", () => {
    vi.useFakeTimers();
    const sendCommand = vi.fn();
    const sendStop = vi.fn();
    const repeater = new ManualCommandRepeater({
      intervalMs: 120,
      sendCommand,
      sendStop,
    });

    repeater.start({ vx: 0, wz: 0.5 });
    repeater.cancel();
    vi.advanceTimersByTime(120);

    expect(sendCommand).toHaveBeenCalledTimes(1);
    expect(sendStop).not.toHaveBeenCalled();
  });
});
