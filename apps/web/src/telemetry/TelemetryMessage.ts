export interface AckRejectTelemetry {
  msg_type: "ack" | "reject";
  seq: number;
  accepted: boolean;
  reason: string;
}

export interface SafetyStateTelemetry {
  msg_type: "safety_state";
  estop: "clear" | "latched";
  heartbeat: "ok" | "timeout";
  cmd: "active" | "expired" | "inactive";
  safety_stop: boolean;
  now_ms: number;
  active_mode?: "none" | "drive" | "brake" | "coast";
  left_pwm?: number;
  right_pwm?: number;
}

export type TelemetryMessage = AckRejectTelemetry | SafetyStateTelemetry;

export function parseTelemetryMessage(text: string): TelemetryMessage {
  const value: unknown = JSON.parse(text);
  if (!isRecord(value) || typeof value.msg_type !== "string") {
    throw new Error("Telemetry message is missing msg_type");
  }

  if (value.msg_type === "ack" || value.msg_type === "reject") {
    if (
      typeof value.seq !== "number" ||
      typeof value.accepted !== "boolean" ||
      typeof value.reason !== "string"
    ) {
      throw new Error("Invalid ack/reject telemetry message");
    }

    return {
      msg_type: value.msg_type,
      seq: value.seq,
      accepted: value.accepted,
      reason: value.reason,
    };
  }

  if (value.msg_type === "safety_state") {
    if (
      (value.estop !== "clear" && value.estop !== "latched") ||
      (value.heartbeat !== "ok" && value.heartbeat !== "timeout") ||
      (value.cmd !== "active" && value.cmd !== "expired" && value.cmd !== "inactive") ||
      typeof value.safety_stop !== "boolean" ||
      typeof value.now_ms !== "number"
    ) {
      throw new Error("Invalid safety_state telemetry message");
    }

    return {
      msg_type: "safety_state",
      estop: value.estop,
      heartbeat: value.heartbeat,
      cmd: value.cmd,
      safety_stop: value.safety_stop,
      now_ms: value.now_ms,
      ...(isActiveMode(value.active_mode) ? { active_mode: value.active_mode } : {}),
      ...(typeof value.left_pwm === "number" ? { left_pwm: value.left_pwm } : {}),
      ...(typeof value.right_pwm === "number" ? { right_pwm: value.right_pwm } : {}),
    };
  }

  throw new Error(`Unsupported telemetry msg_type: ${value.msg_type}`);
}

function isActiveMode(value: unknown): value is "none" | "drive" | "brake" | "coast" {
  return value === "none" || value === "drive" || value === "brake" || value === "coast";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
