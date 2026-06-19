export const BLE_GATT_UUIDS = {
  roverControlService: "7b5a0000-6f5a-4d1d-9c0a-5b4f8b7a0000",
  commandWriteCharacteristic: "7b5a0001-6f5a-4d1d-9c0a-5b4f8b7a0000",
  telemetryNotifyCharacteristic: "7b5a0002-6f5a-4d1d-9c0a-5b4f8b7a0000",
  statusReadCharacteristic: "7b5a0003-6f5a-4d1d-9c0a-5b4f8b7a0000",
} as const;

export type BleGattUuidName = keyof typeof BLE_GATT_UUIDS;

export const BLE_GATT_CONTRACT = {
  encoding: "utf-8-json-rover-packet",
  heartbeatPeriodMs: 250,
  heartbeatTimeoutMs: 1000,
  defaultCmdVelTtlMs: 300,
  initialMtuPolicy: "single-rover-packet-per-ble-write",
} as const;
