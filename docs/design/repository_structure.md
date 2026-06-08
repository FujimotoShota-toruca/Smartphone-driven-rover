# リポジトリ構成案

```text
smartphone-rover/
  README.md

  docs/
    requirements/
      requirements.md
    design/
      design_doc.md
      architecture.md
      safety.md
      protocol.md
      mission_database.md
      repository_structure.md
    adr/
      DEC-001-platform.md
      ...

  mission/
    core/
      commands.yaml
      telemetry.yaml
      safety.yaml
      packet.yaml
    missions/
      engineering_rover_demo.yaml
      autonomous_cone_rover.yaml
      tanegashima_auto_control.yaml
      mini_satellite_demo.yaml
    boards/
      minimal_2wheel_pico_board.yaml
      tanegashima_rover_board.yaml
      virtual_sim_board.yaml
    ui/
      default_ui.yaml

  packages/
    protocol/
      src/
      tests/
    mission-db/
      src/
      schemas/
      tests/
    logger/
      src/
      tests/
    replay/
      src/
      tests/

  apps/
    web/
      src/
        smartphone/
        ground-station/
        components/
        transports/
        autonomy/
        telemetry/
    cloud/
      src/
        auth/
        websocket/
        mission/
        logging/

  firmware/
    pico-w/
      src/
      include/
      generated/
      tests/

  adapters/
    ros/
      src/
      README.md

  tools/
    validate-mission-db/
    generate-types/
    generate-pico-headers/
    export-csv/
```

## 依存方向

```text
apps/web       → packages/protocol, packages/mission-db, packages/logger
apps/cloud     → packages/protocol, packages/mission-db, packages/logger
adapters/ros   → packages/protocol, JSONL logs, WSS API
firmware/pico  → generated C/C++ headers, BLE protocol
```

firmwareはWeb/Cloud実装に直接依存しない。Pico Wは生成済み定義とBLE protocolのみを通じて接続する。
