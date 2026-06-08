# DEC-006: スマホOBCの責務

Status: Accepted  
Date: 2026-06-08

## Context

スマホを単なるUI/中継器ではなく、Lv2自律制御の主計算機として扱う必要がある。

## Decision

スマホはCore Platformにおける主計算機/OBCとする。

## Consequences

Lv1では手動UI、Lv2では自律制御、Lv3ではPC/CloudとPico W間の中継OBCとして動作する。

## Notes

このADRは初期設計判断の記録であり、実装フェーズで詳細要件やインターフェースが更新された場合は追記する。
