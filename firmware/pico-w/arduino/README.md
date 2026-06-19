# Pico W Arduino Firmware Skeleton

This directory is the Arduino C++ firmware skeleton for the Pico W lower I/O
controller. The first target core is
[arduino-pico](https://github.com/earlephilhower/arduino-pico).

The Pico W is treated as a capability-based lower controller. It executes a
small fixed set of hardware capabilities, while mission profile authorization,
schema hash validation, and higher-level planning remain outside the firmware.

## Build Targets

## Development Policy

Arduino IDE is the primary debug path for Pico W firmware bring-up. Open
`arduino.ino`, select board and port, set Serial Monitor to `115200` baud with
line ending `Newline`, and use the Serial mock CUI to check lower I/O.

PlatformIO is the secondary path for reproducibility and CI-style build checks.
It remains useful, but it is not required for daily hardware debugging.

See [Arduino IDE Debug Workflow](docs/arduino_ide_debug_workflow.md) and
[Serial Mock CUI Lesson](docs/serial_mock_cui_lesson.md).

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
- Serial Monitor line ending: `Newline`.

Serial mock is the default Arduino IDE debug build. For the experimental BLE
advertise-only build:

1. Enable `Tools -> IP/Bluetooth Stack` with Bluetooth.
2. Open `src/config/RoverBuildConfig.h`.
3. Uncomment `#define ROVER_ENABLE_BLE_GATT`.
4. Upload from Arduino IDE.
5. Scan from a phone or PC BLE scanner for `SmartphoneRover-PicoW`.

Keep the define commented for normal Serial mock debugging.

After upload, the firmware starts in a stopped state. This is intentional. The
current mock transport reads one line at a time from Serial Monitor. Send each
command with Enter:

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

Debug aliases combine one heartbeat with one motion command:

- `hw`: heartbeat, then forward.
- `hs`: heartbeat, then reverse.
- `ha`: heartbeat, then left turn.
- `hd`: heartbeat, then right turn.
- `hx`: heartbeat, then stop.
- `hn`: heartbeat, then neutral.

Status interval commands must use exactly five digits after `?`. For example,
use `?01000` for 1000 ms. A shorter form such as `?1000` is rejected so `?` and
`?NNNNN` do not conflict.

Because heartbeat timeout is enabled, drive commands are only applied while a
recent `h` heartbeat exists. If no heartbeat is received for the timeout window,
or if the active `cmd_vel` TTL expires, the firmware returns to `motor.stop()`.

Periodic status intervals are accepted only from 250 ms to 60000 ms. Status does
not report measured speed because this firmware skeleton has no wheel encoder or
IMU feedback. It reports safety state and whether the last `cmd_vel` is fresh or
expired.

For a step-by-step Serial mock workflow, see
[Serial Mock CUI Lesson](docs/serial_mock_cui_lesson.md).

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

The current BLE code is a characteristic skeleton experiment. It registers the
rover control service UUID, adds command write / telemetry notify / status read
characteristics, and starts advertising as `SmartphoneRover-PicoW`. It does not
yet parse command payloads or produce real telemetry. Serial mock remains the
default bring-up transport.

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

Bluetooth LE Explorer check:

1. Connect to `SmartphoneRover-PicoW`.
2. Confirm custom service UUID
   `7b5a0000-6f5a-4d1d-9c0a-5b4f8b7a0000`.
3. Confirm command write characteristic
   `7b5a0001-6f5a-4d1d-9c0a-5b4f8b7a0000`.
4. Confirm telemetry notify characteristic
   `7b5a0002-6f5a-4d1d-9c0a-5b4f8b7a0000`.
5. Confirm status read characteristic
   `7b5a0003-6f5a-4d1d-9c0a-5b4f8b7a0000`.

Recommended future BLE bring-up order:

1. Verify characteristic discovery.
2. Verify Web app connection.
3. Verify `heartbeat` write.
4. Verify `emergency_stop` write and latch behavior.
5. Verify `cmd_vel` write with TTL safety stop.

BLE disconnect must be treated like heartbeat loss and must lead to motor stop.

Advertise-only expected result:

- A BLE scanner can see `SmartphoneRover-PicoW`.
- The advertised service UUID matches
  `7b5a0000-6f5a-4d1d-9c0a-5b4f8b7a0000`.

Still not implemented over BLE:

- BLE command action handling.
- Full JSON parser.
- `heartbeat` over BLE.
- `emergency_stop` over BLE.
- `cmd_vel` over BLE.
- Real `ack` / `reject` notify payloads.

BLE command write debug check:

1. Connect from the web app with Web Bluetooth.
2. Press Forward, Stop, or E-stop.
3. Confirm Arduino IDE Serial Monitor prints lines like:

```text
BLE command write received bytes=337
BLE command payload preview={... "msg_type":"cmd_vel" ...}
BLE command msg_type=cmd_vel
```

The command write callback copies `valueData()` / `valueLen()` into a fixed
512-byte debug buffer. Payload preview and `msg_type` classification are then
printed from the main loop side. Payloads longer than the buffer are truncated
and marked in the Serial output.

Expected debug classifications:

- Forward / Back / Left / Right / Stop / Neutral: `msg_type=cmd_vel`.
- E-stop: `msg_type=emergency_stop`.
- Unknown or unsupported payloads: `msg_type=unknown`.

At this stage, only BLE `emergency_stop` is connected to the firmware safety
path. It is routed through `PacketHandler`, latches E-stop, and causes the main
loop to fall back to `motor.stop()`. BLE `cmd_vel` and BLE `heartbeat` are still
debug-only and ignored by the Safety Kernel.

BLE E-stop check:

1. Connect from the web app with Web Bluetooth.
2. Press E-stop.
3. Confirm Arduino IDE Serial Monitor prints:

```text
BLE command msg_type=emergency_stop
BLE command handling=handled emergency_stop
```

4. Send `?` in Serial Monitor and confirm E-stop is latched.
5. Send `r` in Serial Monitor and confirm the latch can be reset.

BLE motion commands still must not move motors. Forward / Back / Left / Right /
Stop / Neutral should print `msg_type=cmd_vel` and
`BLE command handling=ignored debug_only`.

## Hardware Check Notes

Arduino IDE hardware bring-up has been checked with the Serial mock firmware and
was broadly successful. Use Serial Monitor with line ending set to `Newline`.
Confirmed Serial mock commands:

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
- `hw`, `hs`, `ha`, `hd`, `hx`, `hn`: heartbeat plus motion debug aliases.

PlatformIO build verification is still a separate item because local PlatformIO
availability and toolchain setup differ by environment.

The Serial mock transport is a debug transport for lower I/O and safety-kernel
bring-up before BLE is implemented. It is not the BLE wire protocol.
PlatformIO device monitor should also be used line-by-line: type one command and
press Enter.

Recommended next verification order:

1. Arduino IDE Serial mock check.
2. BLE experimental build check.
3. BLE advertise.
4. Web app connection.
5. `heartbeat`.
6. `emergency_stop`.
7. `cmd_vel`.
