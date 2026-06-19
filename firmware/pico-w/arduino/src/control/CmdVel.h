#pragma once

#include <stdint.h>

namespace rover {

struct CmdVel {
  float vx = 0.0f;
  float wz = 0.0f;
  bool brake = false;
  uint32_t ttlMs = 300;
};

struct MotorCommand {
  float left = 0.0f;
  float right = 0.0f;
  bool brake = false;
};

}  // namespace rover
