import { describe, expect, it } from "vitest";

import {
  getBluetoothOrThrow,
  isWebBluetoothAvailable,
} from "../src/transport/BluetoothAvailability";

describe("BluetoothAvailability", () => {
  it("detects Web Bluetooth support", () => {
    expect(
      isWebBluetoothAvailable({
        bluetooth: {
          requestDevice: async () => {
            throw new Error("not used");
          },
        },
      }),
    ).toBe(true);
  });

  it("detects unsupported environments", () => {
    expect(isWebBluetoothAvailable({})).toBe(false);
  });

  it("throws a clear error when Web Bluetooth is unavailable", () => {
    expect(() => getBluetoothOrThrow({})).toThrow(
      "Web Bluetooth is not available in this browser",
    );
  });
});
