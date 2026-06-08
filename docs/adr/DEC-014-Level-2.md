# DEC-014: Level 2自律アルゴリズム

Status: Accepted  
Date: 2026-06-08

## Context

Lv2ではスマホOBCによるGNSS粗誘導とカメラ近距離誘導を実現する。

## Decision

GNSS誘導 + HSVカラーコーン検出 + CAM Visual Servoing + ゴール判定。safe/attack接近はProfileで切替。

## Consequences

safe接近とattack接近をMission Profileで切り替える。AI/SLAMは将来拡張。

## Notes

このADRは初期設計判断の記録であり、実装フェーズで詳細要件やインターフェースが更新された場合は追記する。
