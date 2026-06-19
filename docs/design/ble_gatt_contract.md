# BLE GATT Contract

Status: initial contract for Lv1 Web Bluetooth and Pico W BLE Peripheral.

This document fixes the BLE service, characteristic, and packet-flow contract
before implementing `WebBluetoothTransport` or the Pico W BLE GATT Peripheral.
The initial wire format is UTF-8 JSON using the shared `RoverPacket` envelope
and `JsonPacketCodec`. The contract keeps the codec boundary explicit so the
transport can later move from JSON to CBOR or another packet codec without
changing the safety and authorization rules.

## UUIDs

Use custom 128-bit UUIDs for the Smartphone Driven Rover BLE service.

| Name | UUID | Direction | Required |
| --- | --- | --- | --- |
| Rover Control Service | `7b5a0000-6f5a-4d1d-9c0a-5b4f8b7a0000` | Service | Yes |
| Command Write Characteristic | `7b5a0001-6f5a-4d1d-9c0a-5b4f8b7a0000` | Web app writes, Pico W receives | Yes |
| Telemetry Notify Characteristic | `7b5a0002-6f5a-4d1d-9c0a-5b4f8b7a0000` | Pico W notifies, Web app subscribes | Yes |
| Status Read Characteristic | `7b5a0003-6f5a-4d1d-9c0a-5b4f8b7a0000` | Web app reads, Pico W returns snapshot | Optional |

## Encoding

- Each BLE payload is UTF-8 JSON encoded with the `RoverPacket` envelope.
- Web app encoding must use `JsonPacketCodec.encode(packet)` or an equivalent
  implementation of the `PacketCodec` interface.
- Pico W decoding must validate the common envelope before applying command
  semantics.
- The mandatory envelope fields are:
  - `protocol_version`
  - `mission_id`
  - `rover_id`
  - `packet_type`
  - `msg_type`
  - `seq`
  - `timestamp_ms`
  - `ttl_ms`
  - `schema`
  - `payload`
- `schema` contains:
  - `core_protocol_hash`
  - `mission_db_hash`
  - `board_profile_hash`

## Web App To Pico W Flow

The Web app writes one encoded `RoverPacket` to the Command Write
Characteristic.

Required command flows:

| `msg_type` | `packet_type` | Expected Pico W behavior |
| --- | --- | --- |
| `heartbeat` | `command` | Refresh heartbeat watchdog. No motor command is implied. |
| `cmd_vel` | `command` | Apply only if envelope, schema hash, mission policy, safety policy, and board capability checks passed before write. Pico W still enforces TTL and local safety stop. |
| `emergency_stop` | `command` | Always accept when the envelope is valid. Latch E-stop and force motor stop. |
| `reset_estop` | `command` | Clear E-stop latch only when allowed by higher-level authorization and local firmware policy. |
| `arm_release` | `command` | Reserved for release capability. Requires authorization before write and local safety checks before execution. |
| `fire_nichrome` | `command` | Reserved for release capability. Requires authorization before write and local safety checks before execution. |

The Web app must pass normal command packets through
`CommandAuthorizationPipeline` before writing to BLE. `emergency_stop`,
`heartbeat`, `disconnect`, `basic_status`, and `read_schema_info` remain fixed
safe messages and may be allowed even when schema hashes do not match, provided
the envelope is valid.

## Pico W To Web App Flow

The Pico W sends encoded `RoverPacket` values through the Telemetry Notify
Characteristic.

Required telemetry flows:

| `msg_type` | `packet_type` | Purpose |
| --- | --- | --- |
| `ack` | `telemetry` | Command accepted by the Pico W transport or local executor. |
| `reject` | `telemetry` | Command rejected by envelope, schema, local state, TTL, or safety checks. |
| `pico_hk` | `telemetry` | Basic Pico W housekeeping. |
| `safety_state` | `telemetry` | E-stop latch, heartbeat state, TTL state, and motor safety state. |

The optional Status Read Characteristic returns a current `safety_state` style
snapshot. It is for diagnostics and must not be required for safety behavior.

## Ack And Reject Payloads

Minimum `ack` payload:

```json
{
  "ack_seq": 42,
  "accepted_msg_type": "cmd_vel",
  "accepted": true
}
```

Minimum `reject` payload:

```json
{
  "reject_seq": 42,
  "rejected_msg_type": "cmd_vel",
  "reason": "schema_hash_mismatch",
  "errors": ["mission_db_hash mismatch"]
}
```

`reason` should be a stable machine-readable string. `errors` may contain
human-readable diagnostics and should stay short enough for BLE transport.

## Heartbeat And Timeout

- Web app heartbeat period: 250 ms.
- Pico W heartbeat timeout: 1000 ms.
- The Pico W must treat BLE disconnect as heartbeat timeout.
- Heartbeat timeout must force motor stop.
- Heartbeat is a fixed safe message and may be accepted under schema hash
  mismatch when the envelope is valid.

## `cmd_vel` TTL

- `cmd_vel.ttl_ms` is part of the `RoverPacket` envelope.
- Lv1 default `cmd_vel.ttl_ms`: 300 ms.
- Pico W must stop motor output when the active `cmd_vel` expires.
- A new valid `cmd_vel` replaces the active command and resets the command TTL
  reference.
- TTL expiry is local firmware safety behavior and does not depend on BLE
  connection state.

## Schema Hash Mismatch

When packet schema hashes do not match the current hashes:

- Reject normal commands, including `cmd_vel`, `reset_estop`, `arm_release`,
  and `fire_nichrome`.
- Allow fixed safe messages when the envelope is valid:
  - `emergency_stop`
  - `heartbeat`
  - `basic_status`
  - `disconnect`
  - `read_schema_info`
- Report normal command rejection with a `reject` packet when the telemetry
  notify path is available.

## E-stop Priority

- `emergency_stop` has highest priority.
- A valid `emergency_stop` must be accepted at all times.
- E-stop is latch-style.
- Once latched, motor output must go to stop and remain stopped until an
  explicit reset path clears the latch.
- `reset_estop` is not equivalent to E-stop and is not fixed-safe by default.

## BLE Disconnect Behavior

On BLE disconnect, the Pico W must:

- Treat the event as heartbeat loss.
- Stop motor output.
- Keep E-stop latch state unchanged.
- Require a fresh connection, heartbeat, and valid command before motion can
  resume.

## MTU And Chunking

Initial MVP assumption:

- One `RoverPacket` JSON payload fits into one BLE write.
- Web app should keep command payloads compact.
- Firmware may reject oversized writes.

Future chunking direction:

- Add a transport-level chunk envelope outside the `RoverPacket` envelope.
- Include `message_id`, `chunk_index`, `chunk_count`, and payload bytes.
- Reassemble chunks before passing bytes to `PacketCodec.decode`.
- Keep authorization and envelope validation applied only to the reassembled
  `RoverPacket`.

Chunking is not part of the Lv1 MVP implementation.

## Serial Mock Transport

The Pico W Serial mock transport is independent of this BLE contract. It exists
only for lower I/O and safety-kernel bring-up before BLE GATT is implemented.
Serial mock commands such as `h`, `w`, `e`, `r`, and `?00500` are debug inputs,
not BLE wire protocol messages. BLE implementations must use the UUIDs,
characteristic directions, and JSON `RoverPacket` envelope defined here.

## Out Of Scope

- WebBluetoothTransport implementation.
- Pico W BLE GATT Peripheral implementation.
- Firmware JSON parser implementation.
- Motor control changes.
- Web UI changes.
- Cloud/WSS.
- PWA support.
- Authentication.
- Real BLE interoperability testing.
