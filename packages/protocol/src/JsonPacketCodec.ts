import { CodecError, type PacketCodec } from "./PacketCodec";
import type { RoverPacket } from "./types";

export class JsonPacketCodec implements PacketCodec {
  readonly #encoder = new TextEncoder();
  readonly #decoder = new TextDecoder("utf-8", { fatal: true });

  public encode(packet: RoverPacket): Uint8Array {
    try {
      return this.#encoder.encode(JSON.stringify(packet));
    } catch (error) {
      throw new CodecError("Failed to encode RoverPacket as JSON", {
        cause: error,
      });
    }
  }

  public decode(data: Uint8Array): RoverPacket {
    let json: string;
    let value: unknown;

    try {
      json = this.#decoder.decode(data);
      value = JSON.parse(json);
    } catch (error) {
      throw new CodecError("Failed to decode RoverPacket JSON", {
        cause: error,
      });
    }

    if (!isRecord(value)) {
      throw new CodecError("Decoded RoverPacket must be an object");
    }

    return value as unknown as RoverPacket;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
