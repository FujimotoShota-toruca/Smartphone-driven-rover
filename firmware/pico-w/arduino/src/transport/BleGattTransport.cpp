#include "BleGattTransport.h"

#include "../config/RoverBuildConfig.h"

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
static constexpr size_t kPayloadPreviewLength = 160;

JsonPacketParser commandDebugParser;
uint8_t commandWriteBuffer[kCommandWriteBufferSize] = {};
size_t commandWriteLength = 0;
size_t commandWriteOriginalLength = 0;
bool commandWritePending = false;
bool commandWriteTruncated = false;

RoverMessageType processPendingCommandWriteDebug();
void printPayloadPreview(const uint8_t* data, size_t length, bool truncated);

void onCommandWrite(BLECharacteristic* characteristic) {
  const uint8_t* data =
      reinterpret_cast<const uint8_t*>(characteristic->valueData());
  const size_t originalLength = characteristic->valueLen();
  const size_t copyLength = originalLength < kCommandWriteBufferSize
                                ? originalLength
                                : kCommandWriteBufferSize;

  if (data != nullptr && copyLength > 0) {
    memcpy(commandWriteBuffer, data, copyLength);
  }

  commandWriteLength = copyLength;
  commandWriteOriginalLength = originalLength;
  commandWriteTruncated = originalLength > kCommandWriteBufferSize;
  commandWritePending = true;
}

RoverMessageType processPendingCommandWriteDebug() {
  if (!commandWritePending) {
    return RoverMessageType::None;
  }

  commandWritePending = false;
  const RoverMessageType msgType =
      commandDebugParser.classify(commandWriteBuffer, commandWriteLength);
  const char* msgTypeName =
      commandDebugParser.classifyName(commandWriteBuffer, commandWriteLength);

  Serial.print("BLE command write received bytes=");
  Serial.println(commandWriteOriginalLength);
  Serial.print("BLE command payload preview=");
  printPayloadPreview(commandWriteBuffer, commandWriteLength, commandWriteTruncated);
  Serial.print("BLE command msg_type=");
  Serial.println(msgTypeName);

  if (msgType == RoverMessageType::EmergencyStop) {
    Serial.println("BLE command handling=handled emergency_stop");
    return RoverMessageType::EmergencyStop;
  }

  Serial.println("BLE command handling=ignored debug_only");
  return RoverMessageType::None;
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
  const RoverMessageType pendingType = processPendingCommandWriteDebug();
  if (pendingType == RoverMessageType::EmergencyStop) {
    RoverPacket emergencyStop;
    emergencyStop.type = RoverMessageType::EmergencyStop;
    enqueue(emergencyStop);
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

void BleGattTransport::sendAck(const RoverPacket& packet) {
  notifyPacket(packet, "ack");
}

void BleGattTransport::sendReject(const RoverPacket& packet, const char* reason) {
  if (debugStream_) {
    debugStream_->print("BLE reject reason=");
    debugStream_->println(reason);
  }
  notifyPacket(packet, "reject");
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
  (void)connected_;
  if (!enabled_) {
    return;
  }

  if (debugStream_) {
    debugStream_->print("BLE ");
    debugStream_->print(label);
    debugStream_->print(" seq=");
    debugStream_->println(packet.seq);
  }

#if defined(ROVER_ENABLE_BLE_GATT)
  const char* value = "ble-gatt-skeleton";
  telemetryNotifyCharacteristic.setValue(
      reinterpret_cast<const uint8_t*>(value), strlen(value));
#else
  (void)packet;
  (void)label;
#endif
}

}  // namespace rover
