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
core:

```powershell
cd firmware/pico-w/arduino
pio run
```

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

Not implemented yet:

- BLE GATT Peripheral.
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
