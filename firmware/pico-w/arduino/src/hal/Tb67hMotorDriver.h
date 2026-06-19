#pragma once

#include <Arduino.h>

#include "MotorDriver.h"

namespace rover {

class Tb67hMotorDriver : public MotorDriver {
 public:
  Tb67hMotorDriver(uint8_t leftIn1, uint8_t leftIn2, uint8_t rightIn1,
                   uint8_t rightIn2)
      : leftIn1_(leftIn1),
        leftIn2_(leftIn2),
        rightIn1_(rightIn1),
        rightIn2_(rightIn2) {}

  void begin() override {
    pinMode(leftIn1_, OUTPUT);
    pinMode(leftIn2_, OUTPUT);
    pinMode(rightIn1_, OUTPUT);
    pinMode(rightIn2_, OUTPUT);
    stop();
  }

  void stop() override { brake(); }

  void brake() override {
    analogWrite(leftIn1_, 255);
    analogWrite(leftIn2_, 255);
    analogWrite(rightIn1_, 255);
    analogWrite(rightIn2_, 255);
  }

  void coast() override {
    analogWrite(leftIn1_, 0);
    analogWrite(leftIn2_, 0);
    analogWrite(rightIn1_, 0);
    analogWrite(rightIn2_, 0);
  }

  void setLeftRight(float left, float right) override {
    writeMotor(leftIn1_, leftIn2_, clampUnit(left));
    writeMotor(rightIn1_, rightIn2_, clampUnit(right));
  }

 private:
  uint8_t leftIn1_;
  uint8_t leftIn2_;
  uint8_t rightIn1_;
  uint8_t rightIn2_;

  static float clampUnit(float value) {
    if (value > 1.0f) {
      return 1.0f;
    }
    if (value < -1.0f) {
      return -1.0f;
    }
    return value;
  }

  static uint8_t toPwm(float value) {
    const float magnitude = value < 0.0f ? -value : value;
    return static_cast<uint8_t>(magnitude * 255.0f);
  }

  static void writeMotor(uint8_t in1, uint8_t in2, float value) {
    if (value > 0.0f) {
      analogWrite(in1, toPwm(value));
      analogWrite(in2, 0);
      return;
    }

    if (value < 0.0f) {
      analogWrite(in1, 0);
      analogWrite(in2, toPwm(value));
      return;
    }

    analogWrite(in1, 0);
    analogWrite(in2, 0);
  }
};

}  // namespace rover
