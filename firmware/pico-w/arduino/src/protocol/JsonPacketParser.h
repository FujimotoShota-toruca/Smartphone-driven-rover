#pragma once

#include <Arduino.h>

#include "RoverPacket.h"

namespace rover {

class JsonPacketParser {
 public:
  bool parse(const uint8_t* data, size_t length, RoverPacket& packet) const {
    (void)data;
    (void)length;
    packet = RoverPacket{};
    return false;
  }
};

}  // namespace rover
