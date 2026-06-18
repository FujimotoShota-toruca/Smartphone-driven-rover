# スマホローバー ソフトウェアアーキテクチャ設計ドック

作成日: 2026-06-08

このドキュメント群は、スマホを主計算機/OBC、Raspberry Pi Pico Wを下位I/O制御器、PC/Cloudを地上局・通信系として扱うスマホローバーCore Platformの初期設計資料です。

主成果物はLv1〜Lv3の共通プラットフォームです。種子島ロケットコンテスト対応は、Core Platform上に載るMission Profileの一つとして扱います。

## 含まれるファイル

- `docs/adr/`  
  DEC-001〜DEC-019のArchitecture Decision Record
- `docs/requirements/requirements.md`  
  要求分析・要件定義の初版
- `docs/design/design_doc.md`  
  全体デザインドック初版
- `docs/implementation/implementation_plan.md`  
  実装フェーズとCodex投入Issue案
- `mission/`  
  Mission Database YAMLの初期ひな形
- `docs/design/repository_structure.md`  
  monorepo構成案

## 確定済みの主要判断

- DEC-001: 対応プラットフォーム — 初期正式対応は Android Chrome。iPhone/Safari は将来拡張。
- DEC-002: Webアプリ形態 — PWA前提のWebアプリ。ネイティブラッパーは将来拡張。
- DEC-003: Level 1 MVP範囲 — Lv1 MVPは安全機能付きBLE手動制御基盤まで。
- DEC-004: BLEプロトコル形式 — JSON over BLEを採用し、PacketCodec抽象化を導入する。
- DEC-005A: Core / Mission Profile / Board Profile分離 — Core Platform、Mission Profile、Board Profileを分離する。
- DEC-005: Pico Wの責務 — Pico Wは capability-based lower I/O controller とする。
- DEC-006: スマホOBCの責務 — スマホはCore Platformにおける主計算機/OBCとする。
- DEC-007: Cloud Mission Serverの必須化 — Cloud Mission ServerはLv3で必須。Lv1/Lv2ではCloudなしでも動作可能。
- DEC-008: PC—スマホ通信方式 — Lv3のPC—Cloud—スマホ通信はWSSを採用する。
- DEC-009: 認証・認可 — username/password + server-side session。admin/operator/viewer/phone_nodeを採用。
- DEC-010: Mission Database範囲 — commands/telemetry/safety/mission_profile/board_profile/uiをYAML化対象とする。sequence/DSLは将来拡張。
- DEC-011: schema_hash運用 — schema_hash不一致時は通常コマンド禁止、安全系のみ許可。
- DEC-012: 安全機能 — Fixed Safety Kernel + Profile-configurable Safety Policyを採用。
- DEC-013: 手動操作と自律制御の優先順位 — Manual OverrideはCore Platformに持ち、使用可否はMission Profileで制御する。
- DEC-014: Level 2自律アルゴリズム — GNSS誘導 + HSVカラーコーン検出 + CAM Visual Servoing + ゴール判定。safe/attack接近はProfileで切替。
- DEC-015: ログ・リプレイ設計 — JSONLイベントログ + CSV export。Web地上局リプレイ、ROS/Simulator Adapterは将来拡張。
- DEC-016: ROS/シミュレータ連携 — ROS/SimulatorはCore本体に組み込まずAdapterとして外出しする。
- DEC-017: リポジトリ構成 — monorepo + 厳格なpackage境界。Mission Database / Protocol定義を単一正本として管理。
- DEC-018: Codex投入単位 — Capability単位Issueで投入。安全critical部分はMicro Issue化する。
- DEC-019: Pico W firmware framework — Pico W firmwareはArduino C++で実装し、arduino-picoを第一候補とする。Safety Kernel、BLE、Protocol、Motor HALを分離し、ハード依存処理はHALに閉じ込める。
