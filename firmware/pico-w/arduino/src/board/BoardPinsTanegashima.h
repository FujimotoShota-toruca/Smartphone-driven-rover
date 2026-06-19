#pragma once

#include <Arduino.h>

namespace rover {

struct BoardPinsTanegashima {
  static constexpr uint8_t TB67H_B_IN1 = 0;
  static constexpr uint8_t TB67H_B_IN2 = 1;
  static constexpr uint8_t TB67H_A_IN1 = 2;
  static constexpr uint8_t TB67H_A_IN2 = 3;

  static constexpr uint8_t LED_1 = 14;
  static constexpr uint8_t LED_2 = 15;

  static constexpr uint8_t NICHROME_SW = 20;
  static constexpr uint8_t LIMIT_SWITCH = 21;
  static constexpr uint8_t CDS_ADC0 = 26;
};

}  // namespace rover
