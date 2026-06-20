import type { RoverPacket } from "@smartphone-rover/protocol";

export interface RoverTransport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(packet: RoverPacket): Promise<void>;
  isConnected(): boolean;
  getConnectedDeviceName?(): string | null;
  setTelemetryHandler?(handler: ((message: string) => void) | null): void;
}
