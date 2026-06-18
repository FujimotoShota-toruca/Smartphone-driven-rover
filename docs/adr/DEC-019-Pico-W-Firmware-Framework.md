# DEC-019: Pico W firmware framework

Status: Accepted  
Date: 2026-06-18

## Context

初期Lv1では、Pico W上でBLE GATT Peripheral、GPIO/PWM、watchdog、E-stop、telemetryを短期間で実装する必要がある。

Pico Wは主計算機ではなく、capability-based lower I/O controllerである。そのため、初期実装では低レイヤ最適化よりも開発速度、教育性、デバッグ容易性を優先する。

## Decision

Pico W firmwareはArduino C++で実装する。Arduino coreはarduino-picoを第一候補とする。

Arduino IDEでもPlatformIOでもビルドできる構成を目指す。ただし、firmware内部は巨大な`.ino`にせず、`src/`以下に分割する。

firmware内部では以下を分離する。

- Safety Kernel
- BLE
- Protocol
- Motor HAL

将来Pico SDK C/C++へ移植できるよう、ハード依存処理はHALに閉じ込める。

## Consequences

初期Lv1ではArduino C++により、Pico WのBLE GATT Peripheral、GPIO/PWM、watchdog、E-stop、telemetryを短期間で実装しやすくする。

低レイヤ最適化や厳密なリアルタイム性が必要になった場合は、Pico SDK C/C++への移行を検討する。その場合でも、Safety Kernel、Protocol、BLE、Motor HALの境界を維持し、ハード依存処理をHAL側に限定する。

Mission Profile認可はスマホ/Cloud側の責務であり、Pico Wは固定安全機能とcapability実行を担当する。

## Non-Goals

- 今回はfirmware実装を追加しない。
- Mission Profile認可をPico W firmwareへ持ち込まない。

## Notes

このADRは初期設計判断の記録であり、実装フェーズで詳細要件やインターフェースが更新された場合は追記する。
