#pragma once

#include <Arduino.h>
#include <math.h>
#include <stdlib.h>
#include <string.h>

#include "RoverPacket.h"

namespace rover {

class JsonPacketParser {
 public:
  // Limited parser for BLE bring-up.
  //
  // This is not a full JSON parser. It only extracts the RoverPacket fields
  // currently needed by the firmware MVP. Keep semantic authorization in the
  // upper layers; this parser is only a bounded firmware-side decoder.
  bool parse(const uint8_t* data, size_t length, RoverPacket& packet) const {
    packet = RoverPacket{};
    packet.type = classify(data, length);
    if (packet.type == RoverMessageType::None) {
      return false;
    }

    parseOptionalUint32(data, length, "\"seq\"", packet.seq);
    if (packet.type == RoverMessageType::CmdVel) {
      return parseCmdVel(data, length, packet);
    }

    return true;
  }

  const char* lastError() const { return lastError_; }

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
  static constexpr float kMaxBleCmdVelAbsVx = 1.0f;
  static constexpr float kMaxBleCmdVelAbsWz = 1.0f;
  static constexpr uint32_t kDefaultBleCmdVelTtlMs = 300;
  static constexpr uint32_t kMaxBleCmdVelTtlMs = 500;

  mutable const char* lastError_ = "";

  bool parseCmdVel(const uint8_t* data, size_t length,
                   RoverPacket& packet) const {
    float vx = 0.0f;
    float wz = 0.0f;
    bool brake = false;
    uint32_t ttlMs = kDefaultBleCmdVelTtlMs;

    const char* vxStart = findValueStart(data, length, "\"vx\"");
    if (vxStart == nullptr) {
      lastError_ = "missing_vx";
      return false;
    }
    if (!parseFloatAt(vxStart, vx)) {
      lastError_ = "invalid_number";
      return false;
    }
    const char* wzStart = findValueStart(data, length, "\"wz\"");
    if (wzStart == nullptr) {
      lastError_ = "missing_wz";
      return false;
    }
    if (!parseFloatAt(wzStart, wz)) {
      lastError_ = "invalid_number";
      return false;
    }
    if (!isfinite(vx) || !isfinite(wz)) {
      lastError_ = "invalid_number";
      return false;
    }
    if (fabsf(vx) > kMaxBleCmdVelAbsVx) {
      lastError_ = "vx_limit";
      return false;
    }
    if (fabsf(wz) > kMaxBleCmdVelAbsWz) {
      lastError_ = "wz_limit";
      return false;
    }
    if (!parseOptionalBool(data, length, "\"brake\"", brake) &&
        !isLastParseOk()) {
      lastError_ = "invalid_brake";
      return false;
    }
    if (parseOptionalUint32(data, length, "\"ttl_ms\"", ttlMs)) {
      if (ttlMs == 0 || ttlMs > kMaxBleCmdVelTtlMs) {
        lastError_ = "ttl_out_of_range";
        return false;
      }
    } else if (!isLastParseOk()) {
      lastError_ = "ttl_out_of_range";
      return false;
    }

    packet.cmdVel.vx = vx;
    packet.cmdVel.wz = wz;
    packet.cmdVel.brake = brake;
    packet.cmdVel.ttlMs = ttlMs;
    lastError_ = "";
    return true;
  }

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

  bool parseFloatAt(const char* numberStart, float& output) const {
    char* end = nullptr;
    const float value = strtof(numberStart, &end);
    if (end == numberStart || !isNumberTerminator(*end)) {
      return false;
    }

    output = value;
    return true;
  }

  bool parseOptionalUint32(const uint8_t* data, size_t length, const char* key,
                           uint32_t& output) const {
    lastError_ = "";
    const char* numberStart = findValueStart(data, length, key);
    if (numberStart == nullptr) {
      return false;
    }

    if (*numberStart == '-') {
      lastError_ = "negative integer";
      return false;
    }

    char* end = nullptr;
    const unsigned long value = strtoul(numberStart, &end, 10);
    if (end == numberStart || !isNumberTerminator(*end)) {
      lastError_ = "invalid integer";
      return false;
    }
    if (value > 0xffffffffUL) {
      lastError_ = "integer too large";
      return false;
    }

    output = static_cast<uint32_t>(value);
    return true;
  }

  bool parseOptionalBool(const uint8_t* data, size_t length, const char* key,
                         bool& output) const {
    lastError_ = "";
    const char* valueStart = findValueStart(data, length, key);
    if (valueStart == nullptr) {
      return false;
    }

    if (strncmp(valueStart, "true", 4) == 0 && isNumberTerminator(valueStart[4])) {
      output = true;
      return true;
    }
    if (strncmp(valueStart, "false", 5) == 0 &&
        isNumberTerminator(valueStart[5])) {
      output = false;
      return true;
    }

    lastError_ = "invalid boolean";
    return false;
  }

  bool isLastParseOk() const { return lastError_[0] == '\0'; }

  const char* findValueStart(const uint8_t* data, size_t length,
                             const char* key) const {
    if (data == nullptr || length == 0) {
      return nullptr;
    }

    const char* text = reinterpret_cast<const char*>(data);
    const size_t keyLength = strlen(key);
    for (size_t index = 0; index + keyLength < length; index++) {
      if (memcmp(text + index, key, keyLength) != 0) {
        continue;
      }

      size_t cursor = index + keyLength;
      while (cursor < length && isJsonSpace(text[cursor])) {
        cursor++;
      }
      if (cursor >= length || text[cursor] != ':') {
        return nullptr;
      }
      cursor++;
      while (cursor < length && isJsonSpace(text[cursor])) {
        cursor++;
      }
      if (cursor >= length) {
        return nullptr;
      }

      return text + cursor;
    }

    return nullptr;
  }

  static bool isNumberTerminator(char value) {
    return value == '\0' || value == ',' || value == '}' || value == ']' ||
           isJsonSpace(value);
  }
};

}  // namespace rover
