# DEC-008: PC—スマホ通信方式

Status: Accepted  
Date: 2026-06-08

## Context

Lv3ではPC Ground StationとSmartphone OBCを携帯回線越しに安定して接続する必要がある。

## Decision

Lv3のPC—Cloud—スマホ通信はWSSを採用する。

## Consequences

初期はWSSでコマンド・テレメトリ・ログ同期を扱い、WebRTC/MQTTは将来Adapter扱いにする。

## Notes

このADRは初期設計判断の記録であり、実装フェーズで詳細要件やインターフェースが更新された場合は追記する。
