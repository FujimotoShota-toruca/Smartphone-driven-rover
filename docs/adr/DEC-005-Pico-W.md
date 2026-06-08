# DEC-005: Pico Wの責務

Status: Accepted  
Date: 2026-06-08

## Context

Pico WはスマホOBC配下で、搭載Board Profileに応じた物理I/Oと安全処理を担当する。

## Decision

Pico Wは capability-based lower I/O controller とする。

## Consequences

GNSS誘導、画像航法、ゴール判定、Mission Phase主判断はスマホOBC側に置く。

## Notes

このADRは初期設計判断の記録であり、実装フェーズで詳細要件やインターフェースが更新された場合は追記する。
