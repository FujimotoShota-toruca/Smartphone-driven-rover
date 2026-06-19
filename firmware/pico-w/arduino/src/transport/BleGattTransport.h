#pragma once

#include <Arduino.h>

#include "../protocol/JsonPacketParser.h"
#include "BleGattUuids.h"
#include "RoverTransport.h"

namespace rover {

class BleGattTransport : public RoverTransport {
 public:
  explicit BleGattTransport(Stream* debugStream = nullptr);

  void begin() override;
  bool poll(RoverPacket& packet) override;
  void sendTelemetry(const RoverPacket& packet) override;

  bool hasPacket() const;
  bool readPacket(RoverPacket& packet);
  void sendAck(const RoverPacket& packet, const char* reason);
  void sendReject(const RoverPacket& packet, const char* reason);
  void sendSafetyState(const char* estop, const char* heartbeat, const char* cmd,
                       bool safetyStop, uint32_t nowMs,
                       const char* activeMode = "none", float leftPwm = 0.0f,
                       float rightPwm = 0.0f);
  bool isEnabled() const;

 private:
  static constexpr size_t kQueueSize = 2;

  Stream* debugStream_;
  JsonPacketParser parser_;
  RoverPacket queue_[kQueueSize];
  size_t readIndex_ = 0;
  size_t writeIndex_ = 0;
  size_t queuedCount_ = 0;
  bool enabled_ = false;
  bool connected_ = false;

  bool enqueue(const RoverPacket& packet);
  void notifyPacket(const RoverPacket& packet, const char* label);
  void notifyJson(const char* json, const char* label);
};

}  // namespace rover
