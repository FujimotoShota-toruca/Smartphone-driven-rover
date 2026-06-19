#pragma once

namespace rover {

class MotorDriver {
 public:
  virtual ~MotorDriver() = default;

  virtual void begin() = 0;
  virtual void stop() = 0;
  virtual void brake() = 0;
  virtual void coast() = 0;
  virtual void setLeftRight(float left, float right) = 0;
};

}  // namespace rover
