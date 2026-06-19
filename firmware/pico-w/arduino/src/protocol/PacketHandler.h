#pragma once

#include <Arduino.h>

#include "../control/CmdVel.h"
#include "../hal/MotorDriver.h"
#include "../safety/EstopLatch.h"
#include "../safety/HeartbeatWatchdog.h"
#include "RoverPacket.h"

namespace rover {

struct PacketHandlerState {
  CmdVel& activeCmdVel;
  uint32_t& activeCmdReceivedAtMs;
  bool& hasActiveCmdVel;
  uint32_t& statusIntervalMs;
  uint32_t& nextStatusAtMs;
};

struct PacketHandlerLimits {
  uint32_t minStatusIntervalMs = 250;
  uint32_t maxStatusIntervalMs = 60000;
};

struct PacketHandleResult {
  bool accepted = false;
  bool ackRequired = false;
  const char* reason = "ignored";
  RoverPacket response;
};

class PacketHandler {
 public:
  PacketHandler(PacketHandlerState state, PacketHandlerLimits limits,
                EstopLatch& estopLatch,
                HeartbeatWatchdog& heartbeatWatchdog, MotorDriver& motor,
                Stream* debugStream = nullptr);

  PacketHandleResult handle(const RoverPacket& packet, uint32_t nowMs);

 private:
  PacketHandlerState state_;
  PacketHandlerLimits limits_;
  EstopLatch& estopLatch_;
  HeartbeatWatchdog& heartbeatWatchdog_;
  MotorDriver& motor_;
  Stream* debugStream_;

  PacketHandleResult accept(const RoverPacket& packet, const char* reason) const;
  PacketHandleResult reject(const RoverPacket& packet, const char* reason) const;
  RoverPacket createAck(const RoverPacket& packet) const;
  RoverPacket createReject(const RoverPacket& packet) const;
};

}  // namespace rover
