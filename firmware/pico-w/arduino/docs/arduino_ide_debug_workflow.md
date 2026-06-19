# Arduino IDE Debug Workflow

Arduino IDE is the primary debug path for Pico W firmware bring-up.
PlatformIO remains the secondary path for reproducibility and CI-style build
checks.

## Primary Debug Path

Use Arduino IDE for daily hardware debugging:

1. Open `firmware/pico-w/arduino/arduino.ino`.
2. Select the Pico W board.
3. Select the correct serial port.
4. Upload the sketch.
5. Open Serial Monitor.
6. Set baud rate to `115200`.
7. Set line ending to `Newline`.
8. Use the Serial mock CUI to check lower I/O.

The Serial mock CUI is used to verify heartbeat, `cmd_vel`-equivalent motor
commands, E-stop, TTL timeout, and status output before BLE is implemented.

## Secondary Path

Use PlatformIO for reproducibility checks:

```powershell
py -m platformio run -e pico_w_serial_mock
py -m platformio run -e pico_w_ble_experimental
```

PlatformIO is not required for daily hardware debugging. It should be kept as a
secondary path for reproducible builds and later automation.

## Serial Mock Role

Serial mock transport is a debug transport for lower I/O bring-up before BLE is
implemented. It is not the BLE wire protocol.

Use it to check:

- Heartbeat.
- `cmd_vel`-equivalent motion commands.
- E-stop latch and reset.
- TTL safety stop.
- Status output.

## Gate Before BLE Work

Before moving deeper into BLE implementation, confirm these commands from
Arduino IDE Serial Monitor:

1. `?`
2. `?01000`
3. `?00000`
4. `hw`
5. `ha`
6. `e`
7. `r`

## Next Verification Order

1. Arduino IDE Serial mock check.
2. BLE experimental build check.
3. BLE advertise.
4. Web app connection.
5. `heartbeat`.
6. `emergency_stop`.
7. `cmd_vel`.
