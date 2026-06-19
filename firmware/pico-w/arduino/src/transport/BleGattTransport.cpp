#include "BleGattTransport.h"

namespace rover {

BleGattTransport::BleGattTransport(Stream* debugStream)
    : debugStream_(debugStream) {}

void BleGattTransport::begin() {
#if defined(ROVER_ENABLE_BLE_GATT)
  enabled_ = true;
  if (debugStream_) {
    debugStream_->println("BLE GATT skeleton enabled");
    debugStream_->print("service=");
    debugStream_->println(BleGattUuids::ROVER_CONTROL_SERVICE);
  }

  // BTstack integration belongs in this file only.
  //
  // arduino-pico requires Bluetooth to be enabled in the board build settings.
  // BTstack calls must be protected by BluetoothLock, for example:
  //
  //   {
  //     BluetoothLock lock;
  //     ... BTstack API calls ...
  //   }
  //
  // The exact GATT server API is intentionally not called here until verified
  // against the selected arduino-pico version.
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
