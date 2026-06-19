#include "BleGattTransport.h"

#include "../config/RoverBuildConfig.h"

#if defined(ROVER_ENABLE_BLE_GATT)
#include <BLE.h>
#endif

namespace rover {

#if defined(ROVER_ENABLE_BLE_GATT)
namespace {

BLEService roverControlService(
    BLEUUID(String(BleGattUuids::ROVER_CONTROL_SERVICE)));

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
  BLE.server()->addService(&roverControlService);
  BLE.startAdvertising(true);

  if (debugStream_) {
    debugStream_->println("BLE advertising started");
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

bool BleGattTransport::poll(RoverPacket& packet) { return readPacket(packet); }

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

  // Real notifications will encode RoverPacket as UTF-8 JSON and notify the
  // telemetry characteristic after the BTstack GATT API is selected.
}

}  // namespace rover
