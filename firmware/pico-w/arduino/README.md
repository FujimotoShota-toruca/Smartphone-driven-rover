# Pico W Arduino Firmware Skeleton

This directory is the Arduino C++ firmware skeleton for the Pico W lower I/O
controller. The first target core is
[arduino-pico](https://github.com/earlephilhower/arduino-pico).

The Pico W is treated as a capability-based lower controller. It executes a
small fixed set of hardware capabilities, while mission profile authorization,
schema hash validation, and higher-level planning remain outside the firmware.

## Build Targets

### PlatformIO

The included `platformio.ini` is intended for PlatformIO with the arduino-pico
core. The default environment builds the Serial mock firmware with BLE disabled:

```powershell
cd firmware/pico-w/arduino
pio run -e pico_w_serial_mock
```

The BLE GATT skeleton is separated into an experimental environment:

```powershell
cd firmware/pico-w/arduino
pio run -e pico_w_ble_experimental
```

If PlatformIO is not installed, firmware build verification cannot be completed
in that environment. The source layout can still be opened from Arduino IDE.

### Arduino IDE

Arduino IDE can also be used with the arduino-pico board package. Keep
`src/main.cpp` thin and add new logic under `src/` rather than moving firmware
logic into a large `.ino` file.

Open this directory as the sketch:

```text
firmware/pico-w/arduino
```

The primary sketch file is `arduino.ino` because Arduino requires the `.ino`
file name to match the sketch root folder name. It contains thin `setup()` and
`loop()` entry points that call `roverFirmwareSetup()` and
`roverFirmwareLoop()` in `src/main.cpp`. Arduino IDE compiles files under the
sketch `src/` folder recursively, so the implementation can stay split under
`src/`.

Expected Arduino IDE setup:

- Board package: arduino-pico by Earle F. Philhower.
- Board selection: Raspberry Pi Pico W.
- Sketch folder to open: `firmware/pico-w/arduino`.
- Primary sketch file: `arduino.ino`.
- Serial Monitor baud rate: `115200`.

After upload, the firmware starts in a stopped state. This is intentional. The
current mock transport reads one-character commands from Serial Monitor:

- `h`: heartbeat.
- `w`: forward `cmd_vel`.
- `s`: reverse `cmd_vel`.
- `a`: left turn `cmd_vel`.
- `d`: right turn `cmd_vel`.
- `x`: brake command.
- `n`: neutral command.
- `e`: E-stop latch.
- `r`: reset E-stop latch.
- `?`: print status once.
- `?00500`: print status periodically every 500 ms.
- `?00000`: stop periodic status printing.

Because heartbeat timeout is enabled, drive commands are only applied while a
recent `h` heartbeat exists. If no heartbeat is received for the timeout window,
or if the active `cmd_vel` TTL expires, the firmware returns to `motor.stop()`.

Periodic status intervals are accepted only from 250 ms to 60000 ms. Status does
not report measured speed because this firmware skeleton has no wheel encoder or
IMU feedback. It reports safety state and whether the last `cmd_vel` is fresh or
expired.

## Current Scope

Implemented as skeleton modules:

- Board pin definitions for the Tanegashima Pico W board profile.
- Motor HAL and TB67H motor driver wrapper.
- Differential drive mixing for `cmd_vel`.
- Safety kernel pieces:
  - E-stop latch.
  - Heartbeat timeout.
  - `cmd_vel` TTL guard.
- Transport interface and a Serial-backed mock transport.
- BLE GATT Peripheral transport skeleton behind a compile-time flag.
- Packet handler boundary between transports and safety / motor actions.

Not implemented yet:

- Complete BLE GATT Peripheral.
- JSON packet parser.
- Mission Profile authorization.
- Schema hash verification.
- microSD logging.
- Nichrome fire execution.
- CdS / limit switch telemetry.
- PID or encoder control.

## Safety Responsibilities

The firmware safety kernel must be able to stop motor output locally even when
upper layers are unavailable. In this skeleton:

- E-stop latch always forces `motor.stop()`.
- Heartbeat timeout forces `motor.stop()`.
- Expired `cmd_vel` TTL forces `motor.stop()`.
- Motor output is initialized to a stopped state.

Future BLE GATT support should live behind `RoverTransport`, replacing or
coexisting with the current mock transport without changing the safety kernel
or motor HAL responsibilities.

## BLE GATT Skeleton

The BLE contract follows `docs/design/ble_gatt_contract.md`:

- Service UUID: `7b5a0000-6f5a-4d1d-9c0a-5b4f8b7a0000`.
- Command Write Characteristic UUID:
  `7b5a0001-6f5a-4d1d-9c0a-5b4f8b7a0000`.
- Telemetry Notify Characteristic UUID:
  `7b5a0002-6f5a-4d1d-9c0a-5b4f8b7a0000`.
- Optional Status Read Characteristic UUID:
  `7b5a0003-6f5a-4d1d-9c0a-5b4f8b7a0000`.

The current BLE code is a skeleton. It does not yet register real GATT services
or characteristics. Serial mock remains the default bring-up transport.

Arduino IDE requirements:

- Use arduino-pico for Pico W.
- Enable Bluetooth in `Tools -> IP/Bluetooth Stack`.
- Keep using `firmware/pico-w/arduino` as the sketch folder.

PlatformIO requirements:

- Keep `board_build.core = earlephilhower`.
- Use `pio run -e pico_w_serial_mock` for the default Serial mock build.
- Use `pio run -e pico_w_ble_experimental` only for BLE skeleton experiments.
- The experimental environment defines
  `PIO_FRAMEWORK_ARDUINO_ENABLE_BLUETOOTH` and `ROVER_ENABLE_BLE_GATT`.
- The default Serial mock environment does not define `ROVER_ENABLE_BLE_GATT`.

BTstack notes:

- BTstack calls must stay inside `src/transport/BleGattTransport.cpp`.
- arduino-pico requires the BT `async_context` system lock before BTstack API
  calls. Use `BluetoothLock` around direct BTstack calls.
- Do not call `cyw43_arch_init()` from this firmware; arduino-pico handles Pico W
  variant boot initialization.
- The exact GATT API calls are intentionally not written yet until verified
  against the selected arduino-pico version.

Recommended future BLE bring-up order:

1. Verify advertising and service discovery.
2. Verify `heartbeat` write.
3. Verify `emergency_stop` write and latch behavior.
4. Verify `cmd_vel` write with TTL safety stop.

BLE disconnect must be treated like heartbeat loss and must lead to motor stop.

## Hardware Check Notes

Arduino IDE hardware bring-up has been checked with the Serial mock firmware and
was broadly successful. Confirmed Serial mock commands:

- `h`: heartbeat.
- `w`: forward.
- `s`: reverse.
- `a`: left turn.
- `d`: right turn.
- `x`: stop.
- `n`: neutral.
- `e`: emergency stop.
- `r`: reset E-stop.
- `?`: print status once.
- `?00500`: enable periodic status every 500 ms.
- `?00000`: disable periodic status.

PlatformIO build verification is still a separate item because local PlatformIO
availability and toolchain setup differ by environment.

The Serial mock transport is a debug transport for lower I/O and safety-kernel
bring-up before BLE is implemented. It is not the BLE wire protocol.

Recommended next verification order:

1. PlatformIO Serial mock build.
2. BLE experimental build.
3. BLE advertise.
4. Web app connection.
5. `heartbeat`.
6. `emergency_stop`.
7. `cmd_vel`.
