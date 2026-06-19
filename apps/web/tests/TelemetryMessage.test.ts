import { describe, expect, it } from "vitest";

import { parseTelemetryMessage } from "../src/telemetry/TelemetryMessage";

describe("parseTelemetryMessage", () => {
  it("parses ack telemetry", () => {
    expect(
      parseTelemetryMessage('{"msg_type":"ack","seq":42,"accepted":true,"reason":"handled"}'),
    ).toEqual({
      msg_type: "ack",
      seq: 42,
      accepted: true,
      reason: "handled",
    });
  });

  it("parses reject telemetry", () => {
    expect(
      parseTelemetryMessage(
        '{"msg_type":"reject","seq":7,"accepted":false,"reason":"estop_latched"}',
      ),
    ).toEqual({
      msg_type: "reject",
      seq: 7,
      accepted: false,
      reason: "estop_latched",
    });
  });

  it("parses safety_state telemetry", () => {
    expect(
      parseTelemetryMessage(
        '{"msg_type":"safety_state","estop":"clear","heartbeat":"ok","cmd":"active","safety_stop":false,"now_ms":1234,"active_mode":"drive","left_pwm":0.5,"right_pwm":-0.5}',
      ),
    ).toEqual({
      msg_type: "safety_state",
      estop: "clear",
      heartbeat: "ok",
      cmd: "active",
      safety_stop: false,
      now_ms: 1234,
      active_mode: "drive",
      left_pwm: 0.5,
      right_pwm: -0.5,
    });
  });

  it("rejects malformed telemetry", () => {
    expect(() => parseTelemetryMessage('{"msg_type":"safety_state"}')).toThrow(
      "Invalid safety_state telemetry message",
    );
  });
});
