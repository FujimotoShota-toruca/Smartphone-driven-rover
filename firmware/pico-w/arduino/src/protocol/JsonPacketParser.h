#pragma once

#include <Arduino.h>
#include <string.h>

#include "RoverPacket.h"

namespace rover {

class JsonPacketParser {
 public:
  // Debug-only parser for BLE bring-up.
  //
  // This is not a full JSON parser. It only extracts a string value for
  // "msg_type" from the RoverPacket JSON envelope so BLE writes can be
  // inspected without connecting payloads to the safety kernel or motors.
  bool parse(const uint8_t* data, size_t length, RoverPacket& packet) const {
    packet = RoverPacket{};
    packet.type = classify(data, length);
    return packet.type != RoverMessageType::None;
  }

  RoverMessageType classify(const uint8_t* data, size_t length) const {
    const char* msgType = extractMsgType(data, length);

    if (stringsEqual(msgType, "heartbeat")) {
      return RoverMessageType::Heartbeat;
    }
    if (stringsEqual(msgType, "cmd_vel")) {
      return RoverMessageType::CmdVel;
    }
    if (stringsEqual(msgType, "emergency_stop")) {
      return RoverMessageType::EmergencyStop;
    }
    if (stringsEqual(msgType, "reset_estop")) {
      return RoverMessageType::ResetEstop;
    }
    return RoverMessageType::None;
  }

  const char* classifyName(const uint8_t* data, size_t length) const {
    switch (classify(data, length)) {
      case RoverMessageType::Heartbeat:
        return "heartbeat";
      case RoverMessageType::CmdVel:
        return "cmd_vel";
      case RoverMessageType::EmergencyStop:
        return "emergency_stop";
      case RoverMessageType::ResetEstop:
        return "reset_estop";
      case RoverMessageType::None:
      case RoverMessageType::PrintStatus:
      case RoverMessageType::SetStatusInterval:
      case RoverMessageType::Ack:
      case RoverMessageType::Reject:
      case RoverMessageType::PicoHk:
      case RoverMessageType::SafetyState:
        return "unknown";
    }

    return "unknown";
  }

 private:
  static constexpr const char* kMsgTypeKey = "\"msg_type\"";
  static constexpr size_t kMaxValueLength = 32;

  const char* extractMsgType(const uint8_t* data, size_t length) const {
    if (data == nullptr || length == 0) {
      return "";
    }

    const char* text = reinterpret_cast<const char*>(data);
    const size_t keyLength = strlen(kMsgTypeKey);

    for (size_t index = 0; index + keyLength < length; index++) {
      if (memcmp(text + index, kMsgTypeKey, keyLength) != 0) {
        continue;
      }

      size_t cursor = index + keyLength;
      while (cursor < length && isJsonSpace(text[cursor])) {
        cursor++;
      }
      if (cursor >= length || text[cursor] != ':') {
        return "";
      }

      cursor++;
      while (cursor < length && isJsonSpace(text[cursor])) {
        cursor++;
      }
      if (cursor >= length || text[cursor] != '"') {
        return "";
      }

      cursor++;
      return copyJsonString(text, cursor, length);
    }

    return "";
  }

  static const char* copyJsonString(const char* text, size_t cursor,
                                    size_t length) {
    static char value[kMaxValueLength + 1];
    size_t valueLength = 0;

    while (cursor < length && text[cursor] != '"' &&
           valueLength < kMaxValueLength) {
      value[valueLength] = text[cursor];
      valueLength++;
      cursor++;
    }

    value[valueLength] = '\0';
    return value;
  }

  static bool isJsonSpace(char value) {
    return value == ' ' || value == '\n' || value == '\r' || value == '\t';
  }

  static bool stringsEqual(const char* left, const char* right) {
    return strcmp(left, right) == 0;
  }
};

}  // namespace rover
