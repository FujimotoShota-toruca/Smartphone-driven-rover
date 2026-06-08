# DEC-011: schema_hash運用

Status: Accepted  
Date: 2026-06-08

## Context

YAML定義を各ノードが異なる版で見ていると、コマンド解釈・安全制約の不一致が発生する。

## Decision

schema_hash不一致時は通常コマンド禁止、安全系のみ許可。

## Consequences

hash不一致時は通常コマンドを拒否し、E-stop等の固定安全系のみ許可する。

## Notes

このADRは初期設計判断の記録であり、実装フェーズで詳細要件やインターフェースが更新された場合は追記する。
