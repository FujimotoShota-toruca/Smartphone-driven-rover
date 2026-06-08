# DEC-010: Mission Database範囲

Status: Accepted  
Date: 2026-06-08

## Context

Software Defined Vehicle/Satellite思想の中核として、定義をYAML化したい。

## Decision

commands/telemetry/safety/mission_profile/board_profile/uiをYAML化対象とする。sequence/DSLは将来拡張。

## Consequences

YAMLで定義は変えられるが、初期段階では任意コード実行や複雑DSLは許可しない。

## Notes

このADRは初期設計判断の記録であり、実装フェーズで詳細要件やインターフェースが更新された場合は追記する。
