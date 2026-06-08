# デザインドック初版

作成日: 2026-06-08

## 1. 背景

本プロジェクトは、スマートフォンを利用した2輪独立駆動ローバーのソフトウェアアーキテクチャを設計・実装するものである。

システムは、スマホを主計算機/OBC、Raspberry Pi Pico Wを下位I/O制御器、PC/Cloudを地上局・通信系として扱う。Lv1〜Lv3の段階的な成果物を主とし、種子島ロケットコンテスト対応やROS/Simulator連携はMission Profile/Adapterとして扱う。

## 2. 全体構成

```text
PC Ground Station Web App
  ↕ WSS
Cloud Mission Server
  ↕ WSS
Smartphone OBC Web/PWA
  ↕ BLE GATT / JSON over BLE
Raspberry Pi Pico W lower I/O controller
  ↕ GPIO/PWM/ADC/I2C/SPI
Rover Plant
```

## 3. 3層分離

### Core Platform

Lv1〜Lv3を実現する共通スマホローバー基盤。

- Web/PWA
- BLE Transport
- WSS Transport
- Mission Database
- Safety Kernel
- Logger/Replay
- Cloud Mission Server
- PC Ground Station

### Mission Profile

運用条件・制約を定義する。

例:

- engineering_rover_demo
- autonomous_cone_rover
- tanegashima_auto_control
- mini_satellite_demo
- ros_simulation_bridge

### Board Profile

Pico Wのピンアサイン、搭載I/O、使用可能capabilityを定義する。

例:

- minimal_2wheel_pico_board
- tanegashima_rover_board
- virtual_sim_board

## 4. 責務分担

### Smartphone OBC

- Lv1: 手動操作UI、BLE接続管理、cmd_vel生成、テレメトリ表示
- Lv2: GNSS取得、カメラ取得、状態推定、GNSS誘導、CAM Visual Servoing、ゴール判定
- Lv3: PC/Cloudとの通信、コマンド検査、Pico Wへの転送、ログ同期

### Pico W

Core責務:

- BLE GATT Peripheral
- JSON over BLE packet処理
- cmd_vel受信/検査
- 左右モータ指令変換
- stop/brake/coast/neutral
- heartbeat監視
- watchdog安全停止
- E-stop latch
- pico_hkテレメトリ生成

Board Profile依存責務:

- ニクロム線制御
- CdSセル読み取り
- Limit switch読み取り
- microSDログ保存
- 状態LED制御
- I2C追加センサI/F
- 将来のエンコーダ/電流センサ/ToF等

### Cloud Mission Server

- 認証・認可
- mission_id / rover_id / node_id管理
- WSS中継
- テレメトリ保存
- コマンドログ
- schema/profile hash確認
- Lv3での地上局連携

### PC Ground Station

- テレメトリ監視
- コマンド送信
- ログ閲覧
- リプレイ
- Mission/Profile管理
- 将来的なROS/Simulator Adapter接続

## 5. 通信設計

### BLE

- Pico W ↔ Smartphone OBC
- JSON over BLE
- PacketCodec層を導入
- 将来CBOR/MessagePack/独自バイナリへ移行可能

### WSS

- PC ↔ Cloud ↔ Smartphone
- Lv3で必須
- Cloud Mission Serverが認証・認可・ログ保存を担当

## 6. Packet Envelope

初期案:

```json
{
  "protocol_version": 1,
  "mission_id": "engineering_rover_demo",
  "rover_id": "rover_01",
  "packet_type": "command",
  "msg_type": "cmd_vel",
  "seq": 1024,
  "timestamp_ms": 12345678,
  "ttl_ms": 300,
  "schema": {
    "core_protocol_hash": "core-abc",
    "mission_db_hash": "mission-def",
    "board_profile_hash": "board-ghi"
  },
  "payload": {}
}
```

## 7. Mission Database

正本はYAML。

- commands.yaml
- telemetry.yaml
- safety.yaml
- mission_profile.yaml
- board_profile.yaml
- ui.yaml

sequence/DSLは将来拡張。

## 8. Safety Kernel

固定:

- E-stopは常時有効
- E-stopはlatch式
- heartbeat timeout時はPico Wが安全停止
- cmd_velはttl_ms必須
- stop/brake/coast/neutralを明確化
- schema_hash不一致時は通常コマンド禁止
- release系はarmなしでfire不可
- release系は最大通電時間を持つ
- 未知コマンドは拒否

Profile設定可能:

- max_vx
- max_wz
- max_motor_cmd
- motor_slew_rate
- heartbeat_timeout_ms
- cmd_vel_default_ttl_ms
- release_fire_duration_ms
- release_allowed_modes
- remote_uplink_allowed
- manual_override_allowed

## 9. Lv2 自律制御

基本モード:

```text
IDLE
MANUAL
AUTO_ARMED
GNSS_GUIDANCE
CONE_SEARCH
CAM_VISUAL_SERVOING
GOAL
SAFE_STOP
MANUAL_OVERRIDE
ABORT
```

基本制御:

```text
GNSS:
  heading_error = wrap(target_bearing - current_heading)
  wz = k_heading * heading_error
  vx = v_nominal * speed_scale(distance_to_goal)

CAM:
  ex = cone_center_x - image_center_x
  wz = -k_cam * ex
  vx = vx_safe or vx_attack
```

## 10. ログ・リプレイ

正本ログ:

- スマホOBCのJSONLイベントログ

冗長ログ:

- Pico W microSD下位I/Oログ

同期ログ:

- Lv3でCloud/PCへWSS同期

提出・説明用:

- CSV export

将来:

- ROS/Simulator AdapterでJSONLまたはLive Telemetryを変換

## 11. ROS/Simulator連携

ROSはCore Platformに組み込まず、Adapterとして接続する。

```text
JSONL event log / WSS telemetry
  ↓
ROS/Simulator Adapter
  ↓
ROS topics / simulator inputs
```

## 12. 実装方針

- monorepo + 厳格なpackage境界
- Mission Database / Protocol定義を単一正本として管理
- Codex等への投入はCapability単位Issue
- Safety-critical部分はMicro Issue化して重点レビュー
