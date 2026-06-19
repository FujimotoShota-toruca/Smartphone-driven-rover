import { describe, expect, it, vi } from "vitest";
import { BLE_GATT_UUIDS, type PacketCodec } from "@smartphone-rover/protocol";

import { createCmdVelPacket } from "../src/packet/createCmdVelPacket";
import { WebBluetoothTransport } from "../src/transport/WebBluetoothTransport";
import type {
  BluetoothApi,
  BluetoothRemoteGattCharacteristicLike,
} from "../src/transport/WebBluetoothTransport";

const schema = {
  core_protocol_hash: "core",
  mission_db_hash: "mission",
  board_profile_hash: "board",
};

const packet = createCmdVelPacket({
  missionId: "engineering_rover_demo",
  roverId: "rover_01",
  seq: 1,
  vx: 0.25,
  wz: 0,
  ttlMs: 300,
  schema,
  nowMs: 1000,
});

describe("WebBluetoothTransport", () => {
  it("fails clearly when Web Bluetooth is unavailable", async () => {
    const transport = new WebBluetoothTransport({ navigatorLike: {} });

    await expect(transport.connect()).rejects.toThrow(
      "Web Bluetooth is not available in this browser",
    );
  });

  it("rejects send while disconnected", async () => {
    const transport = new WebBluetoothTransport({ navigatorLike: {} });

    await expect(transport.send(packet)).rejects.toThrow(
      "WebBluetoothTransport is not connected",
    );
  });

  it("connects through the rover service and writes encoded packets", async () => {
    const encoded = new Uint8Array([1, 2, 3]);
    const codec: PacketCodec = {
      encode: vi.fn(() => encoded),
      decode: vi.fn(() => packet),
    };
    const commandWrite = createCharacteristic();
    const telemetryNotify = createCharacteristic();
    const statusRead = createCharacteristic();
    const getCharacteristic = vi.fn(async (uuid: string) => {
      if (uuid === BLE_GATT_UUIDS.commandWriteCharacteristic) {
        return commandWrite;
      }
      if (uuid === BLE_GATT_UUIDS.telemetryNotifyCharacteristic) {
        return telemetryNotify;
      }
      if (uuid === BLE_GATT_UUIDS.statusReadCharacteristic) {
        return statusRead;
      }
      throw new Error(`Unexpected characteristic ${uuid}`);
    });
    const getPrimaryService = vi.fn(async (uuid: string) => {
      expect(uuid).toBe(BLE_GATT_UUIDS.roverControlService);
      return { getCharacteristic };
    });
    const server = {
      connected: true,
      connect: vi.fn(),
      disconnect: vi.fn(),
      getPrimaryService,
    };
    server.connect.mockResolvedValue(server);
    const requestDevice = vi.fn(async () => ({
      gatt: server,
    }));
    const bluetooth: BluetoothApi = { requestDevice };

    const transport = new WebBluetoothTransport({
      navigatorLike: { bluetooth },
      codec,
    });

    await transport.connect();
    await transport.send(packet);

    expect(requestDevice).toHaveBeenCalledWith({
      filters: [{ services: [BLE_GATT_UUIDS.roverControlService] }],
      optionalServices: [BLE_GATT_UUIDS.roverControlService],
    });
    expect(getCharacteristic).toHaveBeenCalledWith(
      BLE_GATT_UUIDS.commandWriteCharacteristic,
    );
    expect(getCharacteristic).toHaveBeenCalledWith(
      BLE_GATT_UUIDS.telemetryNotifyCharacteristic,
    );
    expect(telemetryNotify.startNotifications).toHaveBeenCalled();
    expect(codec.encode).toHaveBeenCalledWith(packet);
    const writtenValue = vi.mocked(commandWrite.writeValue).mock.calls[0][0];
    expect(new Uint8Array(writtenValue as ArrayBuffer)).toEqual(encoded);
  });

  it("serializes concurrent GATT writes", async () => {
    const pendingWrites: Array<() => void> = [];
    let activeWrites = 0;
    let maxActiveWrites = 0;
    const commandWrite = createCharacteristic();
    vi.mocked(commandWrite.writeValue).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          activeWrites += 1;
          maxActiveWrites = Math.max(maxActiveWrites, activeWrites);
          pendingWrites.push(() => {
            activeWrites -= 1;
            resolve();
          });
        }),
    );
    const transport = await createConnectedTransport(commandWrite);

    const firstSend = transport.send(packet);
    const secondSend = transport.send({ ...packet, seq: 2 });

    await Promise.resolve();
    expect(commandWrite.writeValue).toHaveBeenCalledTimes(1);
    expect(maxActiveWrites).toBe(1);

    pendingWrites.shift()?.();
    await expect(firstSend).resolves.toBeUndefined();
    expect(commandWrite.writeValue).toHaveBeenCalledTimes(2);
    expect(maxActiveWrites).toBe(1);

    pendingWrites.shift()?.();
    await expect(secondSend).resolves.toBeUndefined();
    expect(maxActiveWrites).toBe(1);
  });
});

function createCharacteristic(): BluetoothRemoteGattCharacteristicLike {
  const characteristic: BluetoothRemoteGattCharacteristicLike = {
    writeValue: vi.fn(async () => undefined),
    startNotifications: vi.fn(async () => characteristic),
  };
  return characteristic;
}

async function createConnectedTransport(
  commandWrite: BluetoothRemoteGattCharacteristicLike,
): Promise<WebBluetoothTransport> {
  const telemetryNotify = createCharacteristic();
  const statusRead = createCharacteristic();
  const getCharacteristic = vi.fn(async (uuid: string) => {
    if (uuid === BLE_GATT_UUIDS.commandWriteCharacteristic) {
      return commandWrite;
    }
    if (uuid === BLE_GATT_UUIDS.telemetryNotifyCharacteristic) {
      return telemetryNotify;
    }
    if (uuid === BLE_GATT_UUIDS.statusReadCharacteristic) {
      return statusRead;
    }
    throw new Error(`Unexpected characteristic ${uuid}`);
  });
  const server = {
    connected: true,
    connect: vi.fn(),
    disconnect: vi.fn(),
    getPrimaryService: vi.fn(async () => ({ getCharacteristic })),
  };
  server.connect.mockResolvedValue(server);
  const bluetooth: BluetoothApi = {
    requestDevice: vi.fn(async () => ({ gatt: server })),
  };
  const transport = new WebBluetoothTransport({ navigatorLike: { bluetooth } });
  await transport.connect();
  return transport;
}
