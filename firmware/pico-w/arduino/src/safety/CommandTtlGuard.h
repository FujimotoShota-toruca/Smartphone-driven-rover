#pragma once

#include <stdint.h>

namespace rover {

class CommandTtlGuard {
 public:
  bool isExpired(uint32_t receivedAtMs, uint32_t ttlMs, uint32_t nowMs) const {
    return nowMs - receivedAtMs > ttlMs;
  }
};

}  // namespace rover
