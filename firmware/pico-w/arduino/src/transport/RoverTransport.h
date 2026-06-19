#pragma once

#include "../protocol/RoverPacket.h"

namespace rover {

class RoverTransport {
 public:
  virtual ~RoverTransport() = default;

  virtual void begin() = 0;
  virtual bool poll(RoverPacket& packet) = 0;
  virtual void sendTelemetry(const RoverPacket& packet) = 0;
};

}  // namespace rover
