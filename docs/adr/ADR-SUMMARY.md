# ADR Summary

作成日: 2026-06-08

| DEC | 論点 | 状態 | 決定 |
|---|---|---:|---|
| DEC-001 | 対応プラットフォーム | 確定 | 初期正式対応は Android Chrome。iPhone/Safari は将来拡張。 |
| DEC-002 | Webアプリ形態 | 確定 | PWA前提のWebアプリ。ネイティブラッパーは将来拡張。 |
| DEC-003 | Level 1 MVP範囲 | 確定 | Lv1 MVPは安全機能付きBLE手動制御基盤まで。 |
| DEC-004 | BLEプロトコル形式 | 確定 | JSON over BLEを採用し、PacketCodec抽象化を導入する。 |
| DEC-005A | Core / Mission Profile / Board Profile分離 | 確定 | Core Platform、Mission Profile、Board Profileを分離する。 |
| DEC-005 | Pico Wの責務 | 確定 | Pico Wは capability-based lower I/O controller とする。 |
| DEC-006 | スマホOBCの責務 | 確定 | スマホはCore Platformにおける主計算機/OBCとする。 |
| DEC-007 | Cloud Mission Serverの必須化 | 確定 | Cloud Mission ServerはLv3で必須。Lv1/Lv2ではCloudなしでも動作可能。 |
| DEC-008 | PC—スマホ通信方式 | 確定 | Lv3のPC—Cloud—スマホ通信はWSSを採用する。 |
| DEC-009 | 認証・認可 | 確定 | username/password + server-side session。admin/operator/viewer/phone_nodeを採用。 |
| DEC-010 | Mission Database範囲 | 確定 | commands/telemetry/safety/mission_profile/board_profile/uiをYAML化対象とする。sequence/DSLは将来拡張。 |
| DEC-011 | schema_hash運用 | 確定 | schema_hash不一致時は通常コマンド禁止、安全系のみ許可。 |
| DEC-012 | 安全機能 | 確定 | Fixed Safety Kernel + Profile-configurable Safety Policyを採用。 |
| DEC-013 | 手動操作と自律制御の優先順位 | 確定 | Manual OverrideはCore Platformに持ち、使用可否はMission Profileで制御する。 |
| DEC-014 | Level 2自律アルゴリズム | 確定 | GNSS誘導 + HSVカラーコーン検出 + CAM Visual Servoing + ゴール判定。safe/attack接近はProfileで切替。 |
| DEC-015 | ログ・リプレイ設計 | 確定 | JSONLイベントログ + CSV export。Web地上局リプレイ、ROS/Simulator Adapterは将来拡張。 |
| DEC-016 | ROS/シミュレータ連携 | 確定 | ROS/SimulatorはCore本体に組み込まずAdapterとして外出しする。 |
| DEC-017 | リポジトリ構成 | 確定 | monorepo + 厳格なpackage境界。Mission Database / Protocol定義を単一正本として管理。 |
| DEC-018 | Codex投入単位 | 確定 | Capability単位Issueで投入。安全critical部分はMicro Issue化する。 |
| DEC-019 | Pico W firmware framework | 確定 | Pico W firmwareはArduino C++で実装し、arduino-picoを第一候補とする。Safety Kernel、BLE、Protocol、Motor HALを分離し、ハード依存処理はHALに閉じ込める。 |

## 番号運用ルール

- 既存の未確定事項を決めている場合は、元のDEC番号を維持する。
- 途中で前提概念が増えた場合は、`DEC-005A` のように枝番を追加する。
- 番号の振り直しはしない。
- 各回の検討冒頭で「今回決めるDEC番号」を明示する。
