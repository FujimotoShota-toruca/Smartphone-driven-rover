#include <Arduino.h>

#include "FirmwareApp.h"
#include "board/BoardPins.h"
#include "control/DifferentialDriveMixer.h"
#include "hal/Tb67hMotorDriver.h"
#include "protocol/PacketHandler.h"
#include "safety/CommandTtlGuard.h"
#include "safety/EstopLatch.h"
#include "safety/HeartbeatWatchdog.h"
#include "transport/BleGattTransport.h"
#include "transport/MockTransport.h"

namespace {

using namespace rover;

constexpr uint32_t kHeartbeatTimeoutMs = 1000;
constexpr uint32_t kSerialWaitTimeoutMs = 3000;
constexpr uint32_t kMinStatusIntervalMs = 250;
constexpr uint32_t kMaxStatusIntervalMs = 60000;
constexpr uint32_t kBleSafetyStateIntervalMs = 1000;

Tb67hMotorDriver motor(BoardPins::TB67H_B_IN1, BoardPins::TB67H_B_IN2,
                       BoardPins::TB67H_A_IN1, BoardPins::TB67H_A_IN2);
DifferentialDriveMixer mixer;
EstopLatch estopLatch;
HeartbeatWatchdog heartbeatWatchdog(kHeartbeatTimeoutMs);
CommandTtlGuard commandTtlGuard;
MockTransport transport(Serial);
BleGattTransport bleTransport(&Serial);

CmdVel activeCmdVel;
uint32_t activeCmdReceivedAtMs = 0;
bool hasActiveCmdVel = false;
uint32_t statusIntervalMs = 0;
uint32_t nextStatusAtMs = 0;
uint32_t nextBleSafetyStateAtMs = 0;
PacketHandler packetHandler(
    PacketHandlerState{activeCmdVel, activeCmdReceivedAtMs, hasActiveCmdVel,
                       statusIntervalMs, nextStatusAtMs},
    PacketHandlerLimits{kMinStatusIntervalMs, kMaxStatusIntervalMs}, estopLatch,
    heartbeatWatchdog, motor, &Serial);

void processTransport(RoverTransport& packetTransport, uint32_t nowMs,
                      BleGattTransport* responseTransport = nullptr) {
  RoverPacket packet;
  while (packetTransport.poll(packet)) {
    const PacketHandleResult result = packetHandler.handle(packet, nowMs);
    if (packet.type == RoverMessageType::CmdVel) {
      const bool ttlExpired =
          hasActiveCmdVel &&
          commandTtlGuard.isExpired(activeCmdReceivedAtMs, activeCmdVel.ttlMs,
                                    nowMs);
      const MotorCommand mixed =
          packet.cmdVel.manualPwm
              ? MotorCommand{packet.cmdVel.leftPwm, packet.cmdVel.rightPwm,
                             packet.cmdVel.brake}
              : mixer.mix(packet.cmdVel);
      const char* mode = "reject";
      if (result.accepted) {
        mode = packet.cmdVel.brake ? "brake"
                                   : (packet.cmdVel.coast ? "coast" : "drive");
      }
      Serial.print("cmd_vel diagnostic handling=");
      Serial.print(result.accepted ? "handled" : "rejected");
      Serial.print(" reason=");
      Serial.print(result.reason);
      Serial.print(" mode=");
      Serial.print(mode);
      Serial.print(" seq=");
      Serial.print(packet.seq);
      Serial.print(" vx=");
      Serial.print(packet.cmdVel.vx, 3);
      Serial.print(" wz=");
      Serial.print(packet.cmdVel.wz, 3);
      Serial.print(" brake=");
      Serial.print(packet.cmdVel.brake ? "true" : "false");
      Serial.print(" coast=");
      Serial.print(packet.cmdVel.coast ? "true" : "false");
      Serial.print(" ttl_ms=");
      Serial.print(packet.cmdVel.ttlMs);
      Serial.print(" left=");
      Serial.print(mixed.left, 3);
      Serial.print(" right=");
      Serial.print(mixed.right, 3);
      Serial.print(" estop=");
      Serial.print(estopLatch.isLatched() ? "latched" : "clear");
      Serial.print(" heartbeat=");
      Serial.print(heartbeatWatchdog.isTimedOut(nowMs) ? "timeout" : "ok");
      Serial.print(" cmd=");
      Serial.println(!hasActiveCmdVel ? "inactive" : (ttlExpired ? "expired" : "active"));
    }
    if (responseTransport == nullptr || !result.ackRequired ||
        packet.type == RoverMessageType::Heartbeat) {
      continue;
    }

    if (result.accepted) {
      responseTransport->sendAck(result.response, result.reason);
    } else {
      responseTransport->sendReject(result.response, result.reason);
    }
  }
}

bool safetyStopRequired(uint32_t nowMs) {
  if (estopLatch.isLatched()) {
    return true;
  }
  if (heartbeatWatchdog.isTimedOut(nowMs)) {
    return true;
  }
  if (!hasActiveCmdVel) {
    return true;
  }
  if (activeCmdVel.manualPwm) {
    return false;
  }
  return commandTtlGuard.isExpired(activeCmdReceivedAtMs, activeCmdVel.ttlMs,
                                   nowMs);
}

void applyActiveCommand() {
  if (activeCmdVel.manualPwm) {
    if (activeCmdVel.brake) {
      motor.brake();
      return;
    }
    if (activeCmdVel.coast) {
      motor.coast();
      return;
    }
    motor.setLeftRight(activeCmdVel.leftPwm, activeCmdVel.rightPwm);
    return;
  }

  const MotorCommand command = mixer.mix(activeCmdVel);
  if (command.brake) {
    motor.brake();
    return;
  }
  if (command.left == 0.0f && command.right == 0.0f) {
    motor.coast();
    return;
  }
  motor.setLeftRight(command.left, command.right);
}

void printStatus(uint32_t nowMs, bool safetyStop) {
  const bool ttlExpired =
      hasActiveCmdVel && !activeCmdVel.manualPwm &&
      commandTtlGuard.isExpired(activeCmdReceivedAtMs, activeCmdVel.ttlMs,
                                nowMs);

  Serial.print("status now_ms=");
  Serial.print(nowMs);
  Serial.print(" estop=");
  Serial.print(estopLatch.isLatched() ? "latched" : "clear");
  Serial.print(" heartbeat=");
  Serial.print(heartbeatWatchdog.isTimedOut(nowMs) ? "timeout" : "ok");
  Serial.print(" cmd=");
  if (!hasActiveCmdVel) {
    Serial.print("none");
  } else {
    Serial.print(ttlExpired ? "expired" : "fresh");
  }
  Serial.print(" status_interval_ms=");
  Serial.print(statusIntervalMs);
  Serial.print(" safety_stop=");
  Serial.println(safetyStop ? "yes" : "no");
}

void maybePrintStatus(uint32_t nowMs, bool safetyStop) {
  if (nextStatusAtMs == nowMs) {
    printStatus(nowMs, safetyStop);
    nextStatusAtMs = statusIntervalMs > 0 ? nowMs + statusIntervalMs : 0;
    return;
  }

  if (statusIntervalMs > 0 &&
      static_cast<int32_t>(nowMs - nextStatusAtMs) >= 0) {
    printStatus(nowMs, safetyStop);
    nextStatusAtMs = nowMs + statusIntervalMs;
  }
}

void maybeSendBleSafetyState(uint32_t nowMs, bool safetyStop) {
  if (static_cast<int32_t>(nowMs - nextBleSafetyStateAtMs) < 0) {
    return;
  }

  const bool ttlExpired =
      hasActiveCmdVel && !activeCmdVel.manualPwm &&
      commandTtlGuard.isExpired(activeCmdReceivedAtMs, activeCmdVel.ttlMs,
                                nowMs);
  const char* cmdState = !hasActiveCmdVel ? "inactive" : (ttlExpired ? "expired" : "active");
  const char* activeMode = "none";
  if (hasActiveCmdVel) {
    activeMode = activeCmdVel.brake ? "brake" : (activeCmdVel.coast ? "coast" : "drive");
  }
  const float leftPwm = activeCmdVel.manualPwm ? activeCmdVel.leftPwm : 0.0f;
  const float rightPwm = activeCmdVel.manualPwm ? activeCmdVel.rightPwm : 0.0f;
  bleTransport.sendSafetyState(estopLatch.isLatched() ? "latched" : "clear",
                               heartbeatWatchdog.isTimedOut(nowMs) ? "timeout" : "ok",
                               cmdState, safetyStop, nowMs, activeMode, leftPwm,
                               rightPwm);
  nextBleSafetyStateAtMs = nowMs + kBleSafetyStateIntervalMs;
}

void waitForSerial(uint32_t timeoutMs) {
  const uint32_t startedAtMs = millis();
  while (!Serial && millis() - startedAtMs < timeoutMs) {
    delay(10);
  }
}

}  // namespace

void roverFirmwareSetup() {
  Serial.begin(115200);
  waitForSerial(kSerialWaitTimeoutMs);

  pinMode(BoardPins::LED_1, OUTPUT);
  pinMode(BoardPins::LED_2, OUTPUT);

  motor.begin();
  motor.stop();
  heartbeatWatchdog.begin(millis());
  transport.begin();
  bleTransport.begin();
}

void roverFirmwareLoop() {
  const uint32_t nowMs = millis();

  processTransport(transport, nowMs);
  processTransport(bleTransport, nowMs, &bleTransport);

  const bool safetyStop = safetyStopRequired(nowMs);
  maybePrintStatus(nowMs, safetyStop);
  maybeSendBleSafetyState(nowMs, safetyStop);

  if (safetyStop) {
    if (estopLatch.isLatched() || heartbeatWatchdog.isTimedOut(nowMs)) {
      hasActiveCmdVel = false;
    }
    motor.stop();
    digitalWrite(BoardPins::LED_1, HIGH);
    digitalWrite(BoardPins::LED_2, LOW);
    return;
  }

  digitalWrite(BoardPins::LED_1, LOW);
  digitalWrite(BoardPins::LED_2, HIGH);
  applyActiveCommand();
}

#ifdef ROVER_PLATFORMIO_BUILD
void setup() {
  roverFirmwareSetup();
}

void loop() {
  roverFirmwareLoop();
}
#endif
