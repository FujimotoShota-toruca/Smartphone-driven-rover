import type { RoverPacket } from "@smartphone-rover/protocol";

import type { RoverTransport } from "./RoverTransport";

export class MockRoverTransport implements RoverTransport {
  readonly #sentPackets: RoverPacket[] = [];
  #connected = false;

  public async connect(): Promise<void> {
    this.#connected = true;
  }

  public async disconnect(): Promise<void> {
    this.#connected = false;
  }

  public async send(packet: RoverPacket): Promise<void> {
    if (!this.#connected) {
      throw new Error("MockRoverTransport is not connected");
    }

    this.#sentPackets.push(structuredClone(packet));
  }

  public isConnected(): boolean {
    return this.#connected;
  }

  public setTelemetryHandler(): void {
    // Mock transport does not emit firmware telemetry.
  }

  public getSentPackets(): RoverPacket[] {
    return this.#sentPackets.map((packet) => structuredClone(packet));
  }

  public clearLog(): void {
    this.#sentPackets.length = 0;
  }
}
