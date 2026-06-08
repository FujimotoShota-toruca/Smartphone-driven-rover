# DEC-002: Webアプリ形態

Status: Accepted  
Date: 2026-06-08

## Context

スマホ/PCの同一Webアプリ化と、スマホ搭載OBCらしい運用体験を両立したい。

## Decision

PWA前提のWebアプリ。ネイティブラッパーは将来拡張。

## Consequences

初期は通常Webとして開発し、PWA manifest/service workerを段階的に導入する。

## Notes

このADRは初期設計判断の記録であり、実装フェーズで詳細要件やインターフェースが更新された場合は追記する。
