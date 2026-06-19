import {
  BLE_GATT_UUIDS,
  JsonPacketCodec,
  type PacketCodec,
  type RoverPacket,
} from "@smartphone-rover/protocol";

import { getBluetoothOrThrow } from "./BluetoothAvailability";
import type { RoverTransport } from "./RoverTransport";

export interface BluetoothNavigator {
  bluetooth?: BluetoothApi;
}

export interface BluetoothApi {
  requestDevice(options: BluetoothRequestDeviceOptions): Promise<BluetoothDeviceLike>;
}

export interface BluetoothRequestDeviceOptions {
  filters?: Array<{ services: string[] }>;
  optionalServices?: string[];
}

export interface BluetoothDeviceLike {
  gatt?: BluetoothRemoteGattServerLike;
}

export interface BluetoothRemoteGattServerLike {
  connected?: boolean;
  connect(): Promise<BluetoothRemoteGattServerLike>;
  disconnect(): void;
  getPrimaryService(uuid: string): Promise<BluetoothRemoteGattServiceLike>;
}

export interface BluetoothRemoteGattServiceLike {
  getCharacteristic(uuid: string): Promise<BluetoothRemoteGattCharacteristicLike>;
}

export interface BluetoothRemoteGattCharacteristicLike {
  writeValue(value: BufferSource): Promise<void>;
  startNotifications?(): Promise<BluetoothRemoteGattCharacteristicLike>;
}

export interface WebBluetoothTransportOptions {
  navigatorLike?: Partial<BluetoothNavigator>;
  codec?: PacketCodec;
}

export class WebBluetoothTransport implements RoverTransport {
  readonly #navigatorLike?: Partial<BluetoothNavigator>;
  readonly #codec: PacketCodec;
  #device: BluetoothDeviceLike | null = null;
  #server: BluetoothRemoteGattServerLike | null = null;
  #commandWriteCharacteristic: BluetoothRemoteGattCharacteristicLike | null = null;
  #telemetryNotifyCharacteristic: BluetoothRemoteGattCharacteristicLike | null = null;
  #statusReadCharacteristic: BluetoothRemoteGattCharacteristicLike | null = null;
  #writeChain: Promise<void> = Promise.resolve();
  #writeInProgress = false;

  public constructor(options: WebBluetoothTransportOptions = {}) {
    this.#navigatorLike = options.navigatorLike;
    this.#codec = options.codec ?? new JsonPacketCodec();
  }

  public async connect(): Promise<void> {
    const bluetooth = getBluetoothOrThrow(this.#navigatorLike);

    const device = await bluetooth.requestDevice({
      filters: [{ services: [BLE_GATT_UUIDS.roverControlService] }],
      optionalServices: [BLE_GATT_UUIDS.roverControlService],
    });

    if (!device.gatt) {
      throw new Error("Selected Bluetooth device does not expose a GATT server");
    }

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(BLE_GATT_UUIDS.roverControlService);
    const commandWriteCharacteristic = await service.getCharacteristic(
      BLE_GATT_UUIDS.commandWriteCharacteristic,
    );
    const telemetryNotifyCharacteristic = await service.getCharacteristic(
      BLE_GATT_UUIDS.telemetryNotifyCharacteristic,
    );

    if (telemetryNotifyCharacteristic.startNotifications) {
      await telemetryNotifyCharacteristic.startNotifications();
    }

    this.#statusReadCharacteristic = await this.#getOptionalStatusCharacteristic(service);
    this.#device = device;
    this.#server = server;
    this.#commandWriteCharacteristic = commandWriteCharacteristic;
    this.#telemetryNotifyCharacteristic = telemetryNotifyCharacteristic;
  }

  public async disconnect(): Promise<void> {
    if (this.#device?.gatt?.connected) {
      this.#device.gatt.disconnect();
    }

    this.#device = null;
    this.#server = null;
    this.#commandWriteCharacteristic = null;
    this.#telemetryNotifyCharacteristic = null;
    this.#statusReadCharacteristic = null;
    this.#writeChain = Promise.resolve();
    this.#writeInProgress = false;
  }

  public async send(packet: RoverPacket): Promise<void> {
    if (!this.isConnected() || !this.#commandWriteCharacteristic) {
      throw new Error("WebBluetoothTransport is not connected");
    }

    const bytes = this.#codec.encode(packet);
    const payload = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(payload).set(bytes);
    const characteristic = this.#commandWriteCharacteristic;
    const write = this.#writeChain.then(async () => {
      if (!this.isConnected() || this.#commandWriteCharacteristic !== characteristic) {
        throw new Error("WebBluetoothTransport is not connected");
      }

      this.#writeInProgress = true;
      try {
        await characteristic.writeValue(payload);
      } finally {
        this.#writeInProgress = false;
      }
    });

    this.#writeChain = write.catch(() => undefined);
    await write;
  }

  public isConnected(): boolean {
    return Boolean(this.#server?.connected && this.#commandWriteCharacteristic);
  }

  public isWriteInProgress(): boolean {
    return this.#writeInProgress;
  }

  async #getOptionalStatusCharacteristic(
    service: BluetoothRemoteGattServiceLike,
  ): Promise<BluetoothRemoteGattCharacteristicLike | null> {
    try {
      return await service.getCharacteristic(BLE_GATT_UUIDS.statusReadCharacteristic);
    } catch {
      return null;
    }
  }
}
