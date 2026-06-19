# Serial Mock CUI Lesson

This lesson explains the Serial mock command-line workflow for Pico W firmware
bring-up.

## Role

Serial mock transport is a debug transport used before BLE GATT is implemented.
It is not the BLE wire protocol.

Use it to check lower I/O behavior:

- Motor output path.
- Heartbeat timeout.
- E-stop latch and reset.
- `cmd_vel` TTL safety stop.
- Basic status output.

## Arduino IDE Serial Monitor

1. Select the Pico W board and the correct serial port.
2. Open Serial Monitor.
3. Set baud rate to `115200`.
4. Set line ending to `Newline`.
5. Type one command per line and send it with Send or Enter.

For multi-character commands such as `?01000`, type the full command in the
input field and send it as one line.

## PlatformIO Device Monitor

Start the monitor:

```powershell
py -m platformio device monitor -b 115200
```

If a port must be specified:

```powershell
py -m platformio device monitor -b 115200 --port COMx
```

Send one command per line by pressing Enter.

## Commands

| Command | Meaning |
| --- | --- |
| `h` | Heartbeat |
| `w` | Forward |
| `s` | Reverse |
| `a` | Left turn |
| `d` | Right turn |
| `x` | Stop |
| `n` | Neutral |
| `e` | Emergency stop |
| `r` | Reset E-stop |
| `?` | Print status once |
| `?00500` | Print status every 500 ms |
| `?01000` | Print status every 1000 ms |
| `?00000` | Stop periodic status |

Status interval commands use exactly five digits after `?`. For example,
`?01000` is valid, while `?1000` is rejected.

## Heartbeat + Motion Aliases

These aliases are explicit debug shortcuts. They first send heartbeat, then the
motion command.

| Alias | Meaning |
| --- | --- |
| `hw` | Heartbeat, then forward |
| `hs` | Heartbeat, then reverse |
| `ha` | Heartbeat, then left turn |
| `hd` | Heartbeat, then right turn |
| `hx` | Heartbeat, then stop |
| `hn` | Heartbeat, then neutral |

Other multi-character commands are rejected.

## Recommended Check Sequence

1. `?`
2. `?01000`
3. `?00000`
4. `e`
5. `r`
6. `hw`
7. `ha`
8. Stop sending heartbeat and confirm timeout stop.
9. `?00500`
10. `?00000`

## Safety Notes

- Keep wheels lifted or otherwise safe to spin freely.
- Try `hw`, `ha`, and other motion aliases only briefly.
- Confirm E-stop `e` works before motion checks.
- If behavior is unexpected, use E-stop or disconnect USB power.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Garbled text | Baud rate should be `115200`. |
| `?01000` does not work | Confirm line ending is `Newline`. |
| `?1000` is rejected | Use five digits: `?01000`. |
| `ha` is unknown | Confirm the latest firmware was uploaded. |
| Port cannot be opened | Close Arduino IDE Serial Monitor or PlatformIO monitor if another monitor is already using the port. |
