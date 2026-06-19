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
    stream_.println("send one command per line");
  }

  bool poll(RoverPacket& packet) override {
    if (hasPendingPacket_) {
      packet = pendingPacket_;
      hasPendingPacket_ = false;
      return true;
    }

    while (stream_.available()) {
      const char input = static_cast<char>(stream_.read());

      if (input == '\r' || input == '\n') {
        if (lineLength_ == 0) {
          continue;
        }

        lineBuffer_[lineLength_] = '\0';
        const bool parsed = parseLine(packet);
        clearLine();
        return parsed;
      }

      if (lineLength_ >= kLineBufferLength - 1) {
        stream_.println("serial command rejected: line too long");
        clearLine();
        continue;
      }

      lineBuffer_[lineLength_] = input;
      lineLength_++;
    }

    return false;
  }

  void sendTelemetry(const RoverPacket& packet) override {
    stream_.print("telemetry packet seq=");
    stream_.println(packet.seq);
  }

 private:
  static constexpr size_t kLineBufferLength = 32;
  static constexpr uint8_t kStatusDigitCount = 5;

  Stream& stream_;
  uint32_t nextSeq_ = 1;
  char lineBuffer_[kLineBufferLength] = {};
  size_t lineLength_ = 0;
  RoverPacket pendingPacket_;
  bool hasPendingPacket_ = false;

  bool parseLine(RoverPacket& packet) {
    if (lineLength_ == 1) {
      return parseSingleCharCommand(lineBuffer_[0], packet);
    }

    if (lineLength_ == 2 && lineBuffer_[0] == 'h') {
      return parseHeartbeatMotionAlias(lineBuffer_[1], packet);
    }

    if (lineBuffer_[0] == '?') {
      return parseStatusIntervalCommand(packet);
    }

    stream_.println("serial command rejected: unknown command");
    return false;
  }

  bool parseHeartbeatMotionAlias(char motion, RoverPacket& packet) {
    RoverPacket motionPacket;
    if (!buildMotionPacket(motion, motionPacket)) {
      stream_.println("serial command rejected: unknown command");
      return false;
    }

    packet = nextPacket();
    packet.type = RoverMessageType::Heartbeat;
    pendingPacket_ = motionPacket;
    hasPendingPacket_ = true;
    return true;
  }

  bool parseSingleCharCommand(char input, RoverPacket& packet) {
    switch (input) {
      case 'w':
      case 's':
      case 'a':
      case 'd':
      case 'x':
      case 'n':
        return buildMotionPacket(input, packet);
      case 'e':
        packet = nextPacket();
        packet.type = RoverMessageType::EmergencyStop;
        return true;
      case 'h':
        packet = nextPacket();
        packet.type = RoverMessageType::Heartbeat;
        return true;
      case 'r':
        packet = nextPacket();
        packet.type = RoverMessageType::ResetEstop;
        return true;
      case '?':
        packet = nextPacket();
        packet.type = RoverMessageType::PrintStatus;
        return true;
      default:
        stream_.println("serial command rejected: unknown command");
        return false;
    }
  }

  bool parseStatusIntervalCommand(RoverPacket& packet) {
    if (lineLength_ != kStatusDigitCount + 1) {
      stream_.println("status command rejected: use ?NNNNN, for example ?01000");
      return false;
    }

    uint32_t value = 0;
    for (uint8_t index = 1; index <= kStatusDigitCount; index++) {
      const char digit = lineBuffer_[index];
      if (digit < '0' || digit > '9') {
        stream_.println("status command rejected: use ?NNNNN");
        return false;
      }
      value = value * 10 + static_cast<uint32_t>(digit - '0');
    }

    packet = nextPacket();
    packet.type = RoverMessageType::SetStatusInterval;
    packet.statusIntervalMs = value;
    return true;
  }

  bool buildMotionPacket(char motion, RoverPacket& packet) {
    packet = nextPacket();
    packet.type = RoverMessageType::CmdVel;

    switch (motion) {
      case 'w':
        packet.cmdVel = CmdVel{0.5f, 0.0f, false, 300};
        return true;
      case 's':
        packet.cmdVel = CmdVel{-0.5f, 0.0f, false, 300};
        return true;
      case 'a':
        packet.cmdVel = CmdVel{0.0f, -0.5f, false, 300};
        return true;
      case 'd':
        packet.cmdVel = CmdVel{0.0f, 0.5f, false, 300};
        return true;
      case 'x':
        packet.cmdVel = CmdVel{0.0f, 0.0f, true, 300};
        return true;
      case 'n':
        packet.cmdVel = CmdVel{0.0f, 0.0f, false, 300};
        return true;
      default:
        packet = RoverPacket{};
        return false;
    }
  }

  RoverPacket nextPacket() {
    RoverPacket packet;
    packet.seq = nextSeq_++;
    return packet;
  }

  void clearLine() {
    lineLength_ = 0;
    lineBuffer_[0] = '\0';
  }
};

}  // namespace rover
