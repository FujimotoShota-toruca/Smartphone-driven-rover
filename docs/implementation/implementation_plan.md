# 実装計画・Codex投入Issue案

## 方針

- Phase単位で全体計画を管理する。
- Codex等への実装投入はCapability単位Issueで行う。
- Safety-critical部分はMicro Issueに分割し、人間が重点レビューする。

## Phase 0: Documentation and Skeleton

- Issue-000: docs/adr, docs/requirements, docs/design の配置
- Issue-001: monorepo skeleton作成
- Issue-002: package manager / lint / test skeleton導入

## Phase 1: Protocol and Mission Database

- Issue-010: packages/protocolにRoverPacket型を定義
- Issue-011: JsonPacketCodec実装
- Issue-012: Packet envelope validator実装
- Issue-013: mission/core/commands.yaml初期定義
- Issue-014: mission/core/telemetry.yaml初期定義
- Issue-015: mission/core/safety.yaml初期定義
- Issue-016: mission-db validator実装
- Issue-017: schema_hash計算ツール実装
- Issue-018: TypeScript型生成ツール実装
- Issue-019: Pico W C/C++ヘッダ生成ツール実装

## Phase 2: Lv1 BLE Manual Control

- Issue-020: web-app Level 1 UI skeleton
- Issue-021: WebBluetoothTransport実装
- Issue-022: Rover選択UI実装
- Issue-023: cmd_vel生成器実装
- Issue-024: telemetry panel実装
- Issue-025: Pico W firmware skeleton
- Issue-026: Pico W BLE GATT Peripheral実装
- Issue-027: Pico W cmd_vel受信/左右モータ変換
- Issue-028: pico_hk telemetry notify

### Safety Micro Issues

- Issue-S001: heartbeat実装
- Issue-S002: watchdog timeout実装
- Issue-S003: E-stop latch実装
- Issue-S004: cmd_vel TTL検査
- Issue-S005: schema_hash不一致時の通常コマンド拒否
- Issue-S006: stop/brake/coast/neutral処理

## Phase 3: Mission Profile / Board Profile

- Issue-030: Mission Profile loader実装
- Issue-031: Board Profile loader実装
- Issue-032: tanegashima_rover_board.yaml整備
- Issue-033: engineering_rover_demo.yaml整備
- Issue-034: Profile Guard実装
- Issue-035: Manual Override profile制御実装

### Release Micro Issues

- Issue-R001: release arm状態機械
- Issue-R002: fire_nichrome制御
- Issue-R003: release timeout/latch
- Issue-R004: CdS/Limit switch telemetry
- Issue-R005: release confirm判定

## Phase 4: Lv3 Cloud / Ground Station

- Issue-040: cloud-server skeleton
- Issue-041: username/password login
- Issue-042: server-side session cookie
- Issue-043: admin/operator/viewer/phone_node role model
- Issue-044: phone_node token登録
- Issue-045: WSS relay
- Issue-046: command authorization
- Issue-047: telemetry logging
- Issue-048: PC Ground Station telemetry viewer
- Issue-049: command console with Profile Guard

## Phase 5: Logging and Replay

- Issue-050: JSONL event logger
- Issue-051: CSV exporter
- Issue-052: Smartphone local log storage
- Issue-053: Pico W microSD下位ログ
- Issue-054: Cloud log synchronization
- Issue-055: Web Ground Station replay engine
- Issue-056: map/timeline/cmd_vel replay UI

## Phase 6: Lv2 Autonomy

- Issue-060: Autonomy mode manager
- Issue-061: GNSS acquisition
- Issue-062: heading/IMU acquisition
- Issue-063: GNSS guidance
- Issue-064: camera acquisition
- Issue-065: HSV cone detection
- Issue-066: cone search behavior
- Issue-067: CAM Visual Servoing safe mode
- Issue-068: CAM Visual Servoing attack mode
- Issue-069: goal judgement
- Issue-070: autonomy logs

## Phase 7: ROS/Simulator Adapter

- Issue-080: Adapter skeleton
- Issue-081: JSONL replay to simulated topics
- Issue-082: WSS live telemetry adapter
- Issue-083: cmd_vel mapping
- Issue-084: GNSS/heading/pico_hk mapping
- Issue-085: simple 2D simulator connection

## Issue Template

```markdown
# Issue: <Capability name>

## 背景
関連DECと要求IDを書く。

## 対象範囲
対象ディレクトリ・ファイル・packageを書く。

## 要件
実装すべき機能を箇条書きにする。

## 対象外
今回やらないことを書く。

## 受け入れ条件
動作確認・テスト条件を書く。

## テスト
unit / integration / hardware-in-the-loop の方針を書く。
```
