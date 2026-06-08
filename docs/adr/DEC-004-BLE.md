# DEC-004: BLEプロトコル形式

Status: Accepted  
Date: 2026-06-08

## Context

初期デバッグ容易性を優先しつつ、将来的なCBOR/MessagePack/独自バイナリ移行余地を残す。

## Decision

JSON over BLEを採用し、PacketCodec抽象化を導入する。

## Consequences

Web/firmwareともにPacketCodec層を持ち、上位ロジックでJSON.stringify/parseを直接呼ばない。

## Notes

このADRは初期設計判断の記録であり、実装フェーズで詳細要件やインターフェースが更新された場合は追記する。
