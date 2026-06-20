#include "BleGattTransport.h"

#include "../config/RoverBuildConfig.h"

#include <stdio.h>
#include <string.h>

#if defined(ROVER_ENABLE_BLE_GATT)
#include <BLE.h>
#endif

namespace rover {

#if defined(ROVER_ENABLE_BLE_GATT)
namespace {

BLEService roverControlService(
    BLEUUID(String(BleGattUuids::ROVER_CONTROL_SERVICE)));
BLECharacteristic commandWriteCharacteristic(
    BLEUUID(String(BleGattUuids::COMMAND_WRITE_CHARACTERISTIC)), BLEWrite,
    "Rover Command Write");
BLECharacteristic telemetryNotifyCharacteristic(
    BLEUUID(String(BleGattUuids::TELEMETRY_NOTIFY_CHARACTERISTIC)), BLENotify,
    "Rover Telemetry Notify");
BLECharacteristic statusReadCharacteristic(
    BLEUUID(String(BleGattUuids::STATUS_READ_CHARACTERISTIC)), BLERead,
    "Rover Status Read");

static constexpr size_t kCommandWriteBufferSize = 512;
static constexpr size_t kCommandWritePayloadMaxLength = kCommandWriteBufferSize - 1;
static constexpr size_t kPayloadPreviewLength = 160;

JsonPacketParser commandDebugParser;
uint8_t commandWriteBuffer[kCommandWriteBufferSize] = {};
size_t commandWriteLength = 0;
size_t commandWriteOriginalLength = 0;
bool commandWritePending = false;
bool commandWriteTruncated = false;
uint32_t lastHeartbeatLogAtMs = 0;

bool processPendingCommandWriteDebug(RoverPacket& packet,
                                     const char*& rejectReason,
                                     uint32_t& rejectSeq);
void printPayloadPreview(const uint8_t* data, size_t length, bool truncated);

void onCommandWrite(BLECharacteristic* characteristic) {
  const uint8_t* data =
      reinterpret_cast<const uint8_t*>(characteristic->valueData());
  const size_t originalLength = characteristic->valueLen();
  const size_t copyLength =
      data == nullptr ? 0
                      : (originalLength < kCommandWritePayloadMaxLength
                             ? originalLength
                             : kCommandWritePayloadMaxLength);

  if (data != nullptr && copyLength > 0) {
    memcpy(commandWriteBuffer, data, copyLength);
  }
  commandWriteBuffer[copyLength] = '\0';

  commandWriteLength = copyLength;
  commandWriteOriginalLength = originalLength;
  commandWriteTruncated = originalLength > kCommandWritePayloadMaxLength;
  commandWritePending = true;
}

bool processPendingCommandWriteDebug(RoverPacket& packet,
                                     const char*& rejectReason,
                                     uint32_t& rejectSeq) {
  rejectReason = nullptr;
  rejectSeq = 0;
  if (!commandWritePending) {
    return false;
  }

  commandWritePending = false;
  const RoverMessageType msgType =
      commandDebugParser.classify(commandWriteBuffer, commandWriteLength);
  const char* msgTypeName =
      commandDebugParser.classifyName(commandWriteBuffer, commandWriteLength);

  if (msgType == RoverMessageType::Heartbeat && !commandWriteTruncated) {
    if (!commandDebugParser.parse(commandWriteBuffer, commandWriteLength, packet)) {
      Serial.print("BLE command handling=rejected ");
      const char* reason = commandDebugParser.lastError();
      rejectReason = reason[0] == '\0' ? "invalid_json_debug_parser" : reason;
      rejectSeq = packet.seq;
      Serial.println(rejectReason);
      return false;
    }

    const uint32_t nowMs = millis();
    if (nowMs - lastHeartbeatLogAtMs >= 1000) {
      lastHeartbeatLogAtMs = nowMs;
      Serial.println("BLE command msg_type=heartbeat");
      Serial.println("BLE command handling=handled heartbeat");
    }
    return true;
  }

  Serial.print("BLE command write received bytes=");
  Serial.println(commandWriteOriginalLength);
  Serial.print("BLE command payload preview=");
  printPayloadPreview(commandWriteBuffer, commandWriteLength, commandWriteTruncated);
  Serial.print("BLE command msg_type=");
  Serial.println(msgTypeName);

  if (commandWriteTruncated) {
    rejectReason = "truncated_payload";
    Serial.println("BLE command handling=rejected truncated_payload");
    return false;
  }

  if (!commandDebugParser.parse(commandWriteBuffer, commandWriteLength, packet)) {
    Serial.print("BLE command handling=rejected ");
    const char* reason = commandDebugParser.lastError();
    rejectReason = reason[0] == '\0' ? "invalid_json_debug_parser" : reason;
    rejectSeq = packet.seq;
    Serial.println(rejectReason);
    return false;
  }

  if (msgType == RoverMessageType::EmergencyStop) {
    Serial.println("BLE command handling=handled emergency_stop");
    return true;
  }
  if (msgType == RoverMessageType::Heartbeat) {
    Serial.println("BLE command handling=handled heartbeat");
    return true;
  }
  if (msgType == RoverMessageType::ResetEstop) {
    Serial.println("BLE command handling=handled reset_estop");
    return true;
  }
  if (msgType == RoverMessageType::CmdVel) {
    Serial.print("BLE command handling=handled cmd_vel vx=");
    Serial.print(packet.cmdVel.vx, 3);
    Serial.print(" wz=");
    Serial.print(packet.cmdVel.wz, 3);
    Serial.print(" brake=");
    Serial.print(packet.cmdVel.brake ? "true" : "false");
    Serial.print(" ttl_ms=");
    Serial.print(packet.cmdVel.ttlMs);
    Serial.print(" seq=");
    Serial.println(packet.seq);
    return true;
  }

  Serial.println("BLE command handling=ignored debug_only");
  return false;
}

void printPayloadPreview(const uint8_t* data, size_t length, bool truncated) {
  const size_t previewLength =
      length < kPayloadPreviewLength ? length : kPayloadPreviewLength;

  for (size_t index = 0; index < previewLength; index++) {
    const char value = static_cast<char>(data[index]);
    if (value == '\r' || value == '\n' || value == '\t') {
      Serial.print(' ');
    } else if (value == '\0') {
      Serial.print("\\0");
    } else {
      Serial.print(value);
    }
  }

  if (length > previewLength || truncated) {
    Serial.print("...");
  }
  if (truncated) {
    Serial.print(" [truncated]");
  }
  Serial.println();
}

}  // namespace
#endif

BleGattTransport::BleGattTransport(Stream* debugStream)
    : debugStream_(debugStream) {}

void BleGattTransport::begin() {
#if defined(ROVER_ENABLE_BLE_GATT)
  enabled_ = true;
  if (debugStream_) {
    debugStream_->println("BLE advertise-only experiment enabled");
    debugStream_->print("name=");
    debugStream_->println(ROVER_BLE_DEVICE_NAME);
    debugStream_->print("service=");
    debugStream_->println(BleGattUuids::ROVER_CONTROL_SERVICE);
  }

  BLE.begin(String(ROVER_BLE_DEVICE_NAME));
  commandWriteCharacteristic.onWrite(onCommandWrite);
  telemetryNotifyCharacteristic.setValue(
      reinterpret_cast<const uint8_t*>("ble-gatt-skeleton"),
      strlen("ble-gatt-skeleton"));
  statusReadCharacteristic.setValue(
      reinterpret_cast<const uint8_t*>("ble-gatt-skeleton"),
      strlen("ble-gatt-skeleton"));
  roverControlService.addCharacteristic(&commandWriteCharacteristic);
  roverControlService.addCharacteristic(&telemetryNotifyCharacteristic);
  roverControlService.addCharacteristic(&statusReadCharacteristic);
  BLE.server()->addService(&roverControlService);
  BLE.startAdvertising(true);

  if (debugStream_) {
    debugStream_->println("BLE advertising started");
    debugStream_->println("BLE characteristics registered");
  }

  // BLE/BTstack integration belongs in this file only.
  //
  // arduino-pico requires Bluetooth to be enabled in the board build settings.
  // This advertise-only step uses the arduino-pico BLE wrapper API. Future
  // direct BTstack calls must be protected by BluetoothLock and kept here.
#else
  enabled_ = false;
  if (debugStream_) {
    debugStream_->println("BLE GATT disabled; Serial mock transport remains active");
  }
#endif
}

bool BleGattTransport::poll(RoverPacket& packet) {
#if defined(ROVER_ENABLE_BLE_GATT)
  RoverPacket pendingPacket;
  const char* rejectReason = nullptr;
  uint32_t rejectSeq = 0;
  if (processPendingCommandWriteDebug(pendingPacket, rejectReason, rejectSeq)) {
    if (!enqueue(pendingPacket) && debugStream_) {
      debugStream_->println("BLE command handling=rejected queue_full");
      RoverPacket reject;
      reject.relatedSeq = pendingPacket.seq;
      sendReject(reject, "queue_full");
    }
  } else if (rejectReason != nullptr) {
    RoverPacket reject;
    reject.relatedSeq = rejectSeq;
    sendReject(reject, rejectReason);
  }
#endif
  return readPacket(packet);
}

bool BleGattTransport::hasPacket() const { return queuedCount_ > 0; }

bool BleGattTransport::readPacket(RoverPacket& packet) {
  if (queuedCount_ == 0) {
    return false;
  }

  packet = queue_[readIndex_];
  readIndex_ = (readIndex_ + 1) % kQueueSize;
  queuedCount_--;
  return true;
}

void BleGattTransport::sendAck(const RoverPacket& packet, const char* reason) {
  char json[128] = {};
  snprintf(json, sizeof(json),
           "{\"msg_type\":\"ack\",\"seq\":%lu,\"accepted\":true,\"reason\":\"%s\"}",
           static_cast<unsigned long>(packet.relatedSeq), reason);
  notifyJson(json, "ack");
}

void BleGattTransport::sendReject(const RoverPacket& packet, const char* reason) {
  char json[144] = {};
  snprintf(json, sizeof(json),
           "{\"msg_type\":\"reject\",\"seq\":%lu,\"accepted\":false,\"reason\":\"%s\"}",
           static_cast<unsigned long>(packet.relatedSeq), reason);
  notifyJson(json, "reject");
}

void BleGattTransport::sendSafetyState(const char* estop, const char* heartbeat,
                                       const char* cmd, bool safetyStop,
                                       uint32_t nowMs, const char* activeMode,
                                       float leftPwm, float rightPwm) {
  char json[256] = {};
  snprintf(json, sizeof(json),
           "{\"msg_type\":\"safety_state\",\"estop\":\"%s\",\"heartbeat\":\"%s\","
           "\"cmd\":\"%s\",\"safety_stop\":%s,\"now_ms\":%lu,"
           "\"active_mode\":\"%s\",\"left_pwm\":%.3f,\"right_pwm\":%.3f}",
           estop, heartbeat, cmd, safetyStop ? "true" : "false",
           static_cast<unsigned long>(nowMs), activeMode, leftPwm, rightPwm);
  notifyJson(json, "safety_state");
}

void BleGattTransport::sendTelemetry(const RoverPacket& packet) {
  notifyPacket(packet, "telemetry");
}

bool BleGattTransport::isEnabled() const { return enabled_; }

bool BleGattTransport::enqueue(const RoverPacket& packet) {
  if (queuedCount_ == kQueueSize) {
    return false;
  }

  queue_[writeIndex_] = packet;
  writeIndex_ = (writeIndex_ + 1) % kQueueSize;
  queuedCount_++;
  return true;
}

void BleGattTransport::notifyPacket(const RoverPacket& packet, const char* label) {
  char json[96] = {};
  snprintf(json, sizeof(json), "{\"msg_type\":\"%s\",\"seq\":%lu}", label,
           static_cast<unsigned long>(packet.seq));
  notifyJson(json, label);
}

void BleGattTransport::notifyJson(const char* json, const char* label) {
  (void)connected_;
  if (!enabled_) {
    return;
  }

  if (debugStream_) {
    debugStream_->print("BLE ");
    debugStream_->print(label);
    debugStream_->print(" notify=");
    debugStream_->println(json);
  }

#if defined(ROVER_ENABLE_BLE_GATT)
  telemetryNotifyCharacteristic.setValue(
      reinterpret_cast<const uint8_t*>(json), strlen(json));
#else
  (void)json;
  (void)label;
#endif
}

}  // namespace rover
