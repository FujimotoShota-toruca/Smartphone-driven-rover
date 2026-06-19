#pragma once

#include <stdint.h>

#include "../control/CmdVel.h"

namespace rover {

enum class RoverMessageType {
  None,
  CmdVel,
  EmergencyStop,
  Heartbeat,
  ResetEstop,
  PrintStatus,
  SetStatusInterval,
};

struct RoverPacket {
  RoverMessageType type = RoverMessageType::None;
  uint32_t seq = 0;
  CmdVel cmdVel;
  uint32_t statusIntervalMs = 0;
};

}  // namespace rover
