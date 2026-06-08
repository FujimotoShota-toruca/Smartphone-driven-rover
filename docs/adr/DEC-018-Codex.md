# DEC-018: Codex投入単位

Status: Accepted  
Date: 2026-06-08

## Context

Codex等に一括実装を任せると境界が崩れやすい。

## Decision

Capability単位Issueで投入。安全critical部分はMicro Issue化する。

## Consequences

Phaseで計画し、Capability単位Issueで実装し、安全critical部はMicro Issueに分割する。

## Notes

このADRは初期設計判断の記録であり、実装フェーズで詳細要件やインターフェースが更新された場合は追記する。
