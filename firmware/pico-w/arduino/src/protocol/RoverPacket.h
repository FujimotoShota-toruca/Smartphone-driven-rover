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
  Ack,
  Reject,
  PicoHk,
  SafetyState,
};

struct RoverPacket {
  RoverMessageType type = RoverMessageType::None;
  uint32_t seq = 0;
  CmdVel cmdVel;
  uint32_t statusIntervalMs = 0;
  uint32_t relatedSeq = 0;
  const char* reason = "";
};

}  // namespace rover
