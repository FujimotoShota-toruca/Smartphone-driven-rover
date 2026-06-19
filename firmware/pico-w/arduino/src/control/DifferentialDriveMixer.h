#pragma once

#include <math.h>

#include "CmdVel.h"

namespace rover {

class DifferentialDriveMixer {
 public:
  MotorCommand mix(const CmdVel& command) const {
    if (command.brake) {
      return MotorCommand{0.0f, 0.0f, true};
    }

    float left = command.vx - command.wz;
    float right = command.vx + command.wz;
    const float scale = maxAbs(left, right);

    if (scale > 1.0f) {
      left /= scale;
      right /= scale;
    }

    return MotorCommand{clampUnit(left), clampUnit(right), false};
  }

 private:
  static float clampUnit(float value) {
    if (value > 1.0f) {
      return 1.0f;
    }
    if (value < -1.0f) {
      return -1.0f;
    }
    return value;
  }

  static float maxAbs(float left, float right) {
    const float leftAbs = fabsf(left);
    const float rightAbs = fabsf(right);
    return leftAbs > rightAbs ? leftAbs : rightAbs;
  }
};

}  // namespace rover
