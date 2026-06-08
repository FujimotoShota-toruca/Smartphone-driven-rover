# DEC-016: ROS/シミュレータ連携

Status: Accepted  
Date: 2026-06-08

## Context

ROSを本体に混ぜるとWeb/PWA中心のCore PlatformがROS依存になる。

## Decision

ROS/SimulatorはCore本体に組み込まずAdapterとして外出しする。

## Consequences

Coreの正本データモデルはMission Database packetとJSONL event logとし、ROSはAdapter接続する。

## Notes

このADRは初期設計判断の記録であり、実装フェーズで詳細要件やインターフェースが更新された場合は追記する。
