#pragma once

namespace rover {

struct BleGattUuids {
  static constexpr const char* ROVER_CONTROL_SERVICE =
      "7b5a0000-6f5a-4d1d-9c0a-5b4f8b7a0000";
  static constexpr const char* COMMAND_WRITE_CHARACTERISTIC =
      "7b5a0001-6f5a-4d1d-9c0a-5b4f8b7a0000";
  static constexpr const char* TELEMETRY_NOTIFY_CHARACTERISTIC =
      "7b5a0002-6f5a-4d1d-9c0a-5b4f8b7a0000";
  static constexpr const char* STATUS_READ_CHARACTERISTIC =
      "7b5a0003-6f5a-4d1d-9c0a-5b4f8b7a0000";
};

}  // namespace rover
