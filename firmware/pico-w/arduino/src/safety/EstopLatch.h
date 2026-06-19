#pragma once

namespace rover {

class EstopLatch {
 public:
  void trigger() { latched_ = true; }
  void clear() { latched_ = false; }
  bool isLatched() const { return latched_; }

 private:
  bool latched_ = false;
};

}  // namespace rover
