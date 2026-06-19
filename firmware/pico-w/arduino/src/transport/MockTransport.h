#pragma once

#include <Arduino.h>

#include "RoverTransport.h"

namespace rover {

class MockTransport : public RoverTransport {
 public:
  explicit MockTransport(Stream& stream) : stream_(stream) {}

  void begin() override {
    stream_.println("MockTransport ready");
    stream_.println("drive: h + w/s/a/d/x/n, safety: e/r");
    stream_.println("status: ? once, ?00500 periodic ms, ?00000 off");
  }

  bool poll(RoverPacket& packet) override {
    if (parsePendingStatusCommand(packet)) {
      return true;
    }

    if (!stream_.available()) {
      return false;
    }

    const char input = static_cast<char>(stream_.read());
    packet = RoverPacket{};
    packet.seq = nextSeq_++;

    switch (input) {
      case 'w':
        packet.type = RoverMessageType::CmdVel;
        packet.cmdVel = CmdVel{0.5f, 0.0f, false, 300};
        return true;
      case 's':
        packet.type = RoverMessageType::CmdVel;
        packet.cmdVel = CmdVel{-0.5f, 0.0f, false, 300};
        return true;
      case 'a':
        packet.type = RoverMessageType::CmdVel;
        packet.cmdVel = CmdVel{0.0f, -0.5f, false, 300};
        return true;
      case 'd':
        packet.type = RoverMessageType::CmdVel;
        packet.cmdVel = CmdVel{0.0f, 0.5f, false, 300};
        return true;
      case 'x':
        packet.type = RoverMessageType::CmdVel;
        packet.cmdVel = CmdVel{0.0f, 0.0f, true, 300};
        return true;
      case 'n':
        packet.type = RoverMessageType::CmdVel;
        packet.cmdVel = CmdVel{0.0f, 0.0f, false, 300};
        return true;
      case 'e':
        packet.type = RoverMessageType::EmergencyStop;
        return true;
      case 'h':
        packet.type = RoverMessageType::Heartbeat;
        return true;
      case 'r':
        packet.type = RoverMessageType::ResetEstop;
        return true;
      case '?':
        startStatusCommand();
        return parsePendingStatusCommand(packet);
      default:
        return false;
    }
  }

  void sendTelemetry(const RoverPacket& packet) override {
    stream_.print("telemetry packet seq=");
    stream_.println(packet.seq);
  }

 private:
  static constexpr uint8_t kStatusDigitCount = 5;
  static constexpr uint32_t kStatusParseTimeoutMs = 80;

  Stream& stream_;
  uint32_t nextSeq_ = 1;
  bool parsingStatusCommand_ = false;
  uint8_t statusDigitCount_ = 0;
  uint32_t statusValueMs_ = 0;
  uint32_t statusParseStartedAtMs_ = 0;

  void startStatusCommand() {
    parsingStatusCommand_ = true;
    statusDigitCount_ = 0;
    statusValueMs_ = 0;
    statusParseStartedAtMs_ = millis();
  }

  bool parsePendingStatusCommand(RoverPacket& packet) {
    if (!parsingStatusCommand_) {
      return false;
    }

    while (stream_.available()) {
      const char input = static_cast<char>(stream_.peek());

      if (input >= '0' && input <= '9') {
        stream_.read();
        statusValueMs_ = statusValueMs_ * 10 + static_cast<uint32_t>(input - '0');
        statusDigitCount_++;

        if (statusDigitCount_ == kStatusDigitCount) {
          packet = RoverPacket{};
          packet.seq = nextSeq_++;
          packet.type = RoverMessageType::SetStatusInterval;
          packet.statusIntervalMs = statusValueMs_;
          parsingStatusCommand_ = false;
          return true;
        }
        continue;
      }

      if (input == '\r' || input == '\n' || input == ' ') {
        stream_.read();
        if (statusDigitCount_ == 0) {
          packet = RoverPacket{};
          packet.seq = nextSeq_++;
          packet.type = RoverMessageType::PrintStatus;
          parsingStatusCommand_ = false;
          return true;
        }
        stream_.println("status command rejected: use ?NNNNN");
        parsingStatusCommand_ = false;
        return false;
      }

      stream_.read();
      stream_.println("status command rejected: use ?NNNNN");
      parsingStatusCommand_ = false;
      return false;
    }

    if (millis() - statusParseStartedAtMs_ > kStatusParseTimeoutMs) {
      if (statusDigitCount_ == 0) {
        packet = RoverPacket{};
        packet.seq = nextSeq_++;
        packet.type = RoverMessageType::PrintStatus;
        parsingStatusCommand_ = false;
        return true;
      }

      stream_.println("status command rejected: use ?NNNNN");
      parsingStatusCommand_ = false;
    }

    return false;
  }
};

}  // namespace rover
