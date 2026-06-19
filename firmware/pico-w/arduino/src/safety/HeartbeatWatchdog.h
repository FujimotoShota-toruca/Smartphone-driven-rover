#pragma once

#include <stdint.h>

namespace rover {

class HeartbeatWatchdog {
 public:
  explicit HeartbeatWatchdog(uint32_t timeoutMs) : timeoutMs_(timeoutMs) {}

  void begin(uint32_t nowMs) { lastHeartbeatMs_ = nowMs; }
  void markHeartbeat(uint32_t nowMs) { lastHeartbeatMs_ = nowMs; }

  bool isTimedOut(uint32_t nowMs) const {
    return elapsedMs(nowMs, lastHeartbeatMs_) > timeoutMs_;
  }

 private:
  uint32_t timeoutMs_;
  uint32_t lastHeartbeatMs_ = 0;

  static uint32_t elapsedMs(uint32_t nowMs, uint32_t sinceMs) {
    return nowMs - sinceMs;
  }
};

}  // namespace rover
