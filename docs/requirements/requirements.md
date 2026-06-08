# 要求分析・要件定義 初版

作成日: 2026-06-08

## 1. システム目的

本システムは、スマホを主計算機/OBC、Raspberry Pi Pico WをBLE通信機能内蔵の下位I/O制御器、PC/Cloudを地上局・通信系として扱うスマホローバーCore Platformである。

主成果物はLv1〜Lv3の共通プラットフォームである。種子島ロケットコンテスト対応はMission Profileの一つとして扱う。

## 2. レベル定義

### Lv1: BLE手動制御

- スマホPWAからBLEでPico Wへ接続する。
- 手動操作で前進、後退、左回転、右回転、停止、ニュートラルを実行する。
- `cmd_vel`、heartbeat、E-stop、watchdog、簡易テレメトリ、通信ログを含む。

### Lv2: スマホ搭載自律制御

- スマホOBCがGNSS、カメラ、必要に応じてIMU/方位情報を用いて自律制御を行う。
- GNSS誘導、HSVカラーコーン検出、CAM Visual Servoing、ゴール判定を含む。
- safe/attack接近戦略はMission Profileで切り替える。

### Lv3: PC/Cloud/地上局連携

- PC Ground Station、Cloud Mission Server、Smartphone OBCをWSSで接続する。
- 認証、認可、テレメトリ中継、コマンド中継、ログ同期、Web地上局リプレイを行う。
- ROS/Simulator連携はAdapterとして将来拡張する。

## 3. 要求一覧

### REQ-PLATFORM

- REQ-PLATFORM-001: Lv1/Lv2の正式対応スマートフォン環境は Android + Chrome とする。
- REQ-PLATFORM-002: iOS/Safariは初期MVPの対象外とする。
- REQ-PLATFORM-003: BLE通信処理はTransport層に抽象化し、将来的にネイティブラッパー実装へ差し替え可能とする。
- REQ-PLATFORM-004: PC地上局はWindows/macOS/Linux上のChromium系ブラウザを主対象とする。

### REQ-APP

- REQ-APP-001: スマホ/PC側アプリケーションは単一のWebアプリとして実装する。
- REQ-APP-002: スマホ側はPWAとしてホーム画面追加・全画面表示が可能な構成を目指す。
- REQ-APP-003: 初期MVPではネイティブラッパーを必須としない。
- REQ-APP-004: Bluetooth、GPS、Cameraなどのデバイス依存機能はCapability Checkを通じて利用可否を判定する。
- REQ-APP-005: WebアプリはHTTPS配信を前提とする。

### REQ-L1

- REQ-L1-001: スマホWeb/PWAはBLE経由でPico Wに接続できること。
- REQ-L1-002: スマホWeb/PWAは接続可能なローバー候補を表示し、操作者が接続先を選択できること。
- REQ-L1-003: Lv1では前進、後退、左回転、右回転、停止、ニュートラルの手動操作が可能であること。
- REQ-L1-004: 内部コマンド表現は`cmd_vel`とし、並進速度`vx`とヨー角速度`wz`で2輪独立駆動を表現すること。
- REQ-L1-005: Pico Wは受信した`cmd_vel`を左右モータ指令に変換すること。
- REQ-L1-006: Pico Wは一定時間heartbeatまたは有効な走行コマンドを受信しない場合、安全停止すること。
- REQ-L1-007: スマホWeb/PWAはE-stopコマンドを送信できること。
- REQ-L1-008: E-stopは通常の走行コマンドより高い優先度で処理されること。
- REQ-L1-009: Pico Wは最低限のテレメトリをスマホへ送信できること。
- REQ-L1-010: スマホWeb/PWAは送受信したコマンド/テレメトリの簡易ログを表示できること。

### REQ-PROTO

- REQ-PROTO-001: Lv1 MVPのPico W ↔ スマホ間通信ではJSON形式のpacketをBLE GATT上で送受信する。
- REQ-PROTO-002: packetは共通envelopeとpayloadから構成する。
- REQ-PROTO-003: WebアプリおよびPico W firmwareはPacketCodec層を持つ。
- REQ-PROTO-004: すべての走行コマンドpacketは`seq`, `timestamp_ms`, `ttl_ms`, `msg_type`を持つ。
- REQ-PROTO-005: 未知の`msg_type`を受信した場合、受信側は当該packetを破棄し、可能であればNACKまたはerror telemetryを返す。

### REQ-ARCH

- REQ-ARCH-001: 本システムの主成果物は、Lv1〜Lv3に対応するスマホローバー共通プラットフォームとする。
- REQ-ARCH-002: 種子島ロケットコンテスト対応はMission Profileの一つとして扱う。
- REQ-ARCH-003: Mission Profileは、使用可能なcapability、禁止操作、ログ要求、運用モードを定義できること。
- REQ-ARCH-004: Board Profileは、Pico Wのピンアサイン、搭載I/O、使用可能な下位機能を定義できること。
- REQ-ARCH-005: Core Platformは、特定Mission ProfileやBoard Profileに強く依存せず、複数の構成へ適用可能であること。

### REQ-PICO

- REQ-PICO-001: Pico WはBLE GATT Peripheralとして動作し、スマホOBCから接続されること。
- REQ-PICO-002: Pico WはBoard Profileに基づき、有効なI/O capabilityを決定できること。
- REQ-PICO-003: Pico Wは`cmd_vel`を受信し、左右モータ指令に変換できること。
- REQ-PICO-004: Pico Wはheartbeat timeout時に走行系を安全停止すること。
- REQ-PICO-005: Pico WはE-stopをラッチし、明示解除まで走行系アクチュエータを再駆動しないこと。
- REQ-PICO-006: Pico WはBoard Profileで有効化された場合、ニクロム線、CdSセル、Limit switch、microSD、LED、I2CセンサI/Fを扱えること。
- REQ-PICO-007: Pico Wはニクロム線についてarm/fire/timeout/latch/confirmのインターロックを実装できること。
- REQ-PICO-008: Pico WはGNSS誘導、画像航法、カラーコーン検出、ゴール判定、高位Mission Phase管理を担当しないこと。
- REQ-PICO-009: Pico WはMission Profile YAMLを直接解釈しない。必要定義は生成済みコードまたは軽量定義として利用すること。

### REQ-PHONE

- REQ-PHONE-001: スマホはCore Platformにおける主計算機/OBCとして動作すること。
- REQ-PHONE-002: スマホはPico WとのBLE接続を管理し、`cmd_vel`、heartbeat、E-stop等の下位コマンドを送信できること。
- REQ-PHONE-003: スマホはPico Wからのテレメトリを受信し、表示・保存できること。
- REQ-PHONE-004: Lv2では、スマホはGNSS、カメラ、必要に応じてIMU/方位情報を用いて自律制御を実行できること。
- REQ-PHONE-005: スマホはMission Profileに基づき、利用可能な機能、禁止操作、ログ要求を切り替えられること。
- REQ-PHONE-006: Lv3では、スマホはPC/Cloudから受信したコマンドを検査し、許可された場合のみPico Wへ転送すること。
- REQ-PHONE-007: スマホは左右モータPWMやニクロム線GPIOを直接生成・出力しないこと。
- REQ-PHONE-008: スマホは自律制御中に生成した制御指令値、観測値、推定値、状態遷移、判定理由をログとして保存できること。

### REQ-CLOUD / REQ-LINK / REQ-AUTH

- REQ-CLOUD-001: Lv1/Lv2の基本動作はCloud Mission Serverに依存せず実行可能であること。
- REQ-CLOUD-002: Lv3ではCloud Mission Serverを用いてPC Ground StationとSmartphone OBCを接続できること。
- REQ-CLOUD-003: Cloud Mission Serverは認証、認可、mission_id管理、rover_id管理、テレメトリ中継、コマンド中継、ログ保存を担当すること。
- REQ-CLOUD-004: Smartphone OBCはCloud未接続時にもBLE経由でPico Wを制御できること。
- REQ-CLOUD-005: Smartphone OBCはCloud未接続時のログをローカル保存し、接続復帰後に同期できる設計とすること。
- REQ-LINK-001: Lv3ではPC Ground StationとSmartphone OBCはCloud Mission Serverを介してWSSで接続されること。
- REQ-AUTH-001: 認証はusername/password + server-side sessionを基本とする。
- REQ-AUTH-002: セッションはHttpOnly/Secure/SameSite Cookieで管理する。
- REQ-AUTH-003: ロールはadmin/operator/viewer/phone_nodeを採用する。
- REQ-AUTH-004: スマホOBCはphone_nodeとしてCloudへ接続する。

### REQ-SCHEMA / REQ-SAFE

- REQ-SCHEMA-001: PC、Cloud、Smartphone、Pico Wは自身が使用しているschema/profileのhashを報告できること。
- REQ-SCHEMA-002: schema/profile hashは、core_protocol_hash、mission_db_hash、board_profile_hash、ui_profile_hashに分離して管理できること。
- REQ-SCHEMA-003: 走行、分離系、設定変更コマンドは必要hashが一致している場合のみ許可されること。
- REQ-SCHEMA-004: hash不一致時でもemergency_stop、heartbeat、basic_status、disconnect等の固定安全系通信は許可されること。
- REQ-SAFE-001: E-stopはCore Platformの固定安全機能とし、Mission Profileで無効化できないこと。
- REQ-SAFE-002: E-stopはlatch式とし、明示解除まで走行系および危険側アクチュエータを再駆動しないこと。
- REQ-SAFE-003: Pico Wはheartbeat timeout時に走行系を安全停止すること。
- REQ-SAFE-004: すべての`cmd_vel`は`ttl_ms`を持ち、期限切れコマンドは破棄されること。
- REQ-SAFE-005: stop、brake、coast、neutralの意味をCore Protocol上で明確に定義すること。
- REQ-SAFE-006: release系コマンドはarm/fire/timeout/latch/confirmのインターロックを持つこと。
- REQ-SAFE-007: release系コマンドはMission ProfileおよびBoard Profileで許可された場合のみ使用可能であること.
- REQ-SAFE-008: safety.yamlでは安全機能の無効化ではなく、制限値、閾値、許可モードを定義すること。

### REQ-OVR / REQ-AUTO / REQ-LOG / REQ-ROS

- REQ-OVR-001: Core PlatformはManual Override機能を持つこと。
- REQ-OVR-002: Manual Overrideの許可/禁止はMission Profileで定義できること。
- REQ-OVR-005: E-stopはMission Profileに関わらず常に受理されること。
- REQ-AUTO-001: Lv2ではスマホOBCがGNSS、カメラ、必要に応じてIMU/方位情報を用いて自律制御を実行すること。
- REQ-AUTO-002: Lv2の基本自律シーケンスはGNSS_GUIDANCE → CONE_SEARCH → CAM_VISUAL_SERVOING → GOALとする。
- REQ-AUTO-006: CAM Visual Servoingの接近戦略はMission Profileでsafe/attackを切り替えられること。
- REQ-LOG-001: スマホOBCはJSONL形式のイベントログを生成・保存できること。
- REQ-LOG-006: ログはCSV形式へエクスポートできること。
- REQ-ROS-001: ROS/シミュレータ連携はCore Platform本体ではなくAdapterとして実装すること。
- REQ-ROS-007: ROS/Simulator連携は初期MVP必須ではなく、Lv3拡張機能として扱うこと。
