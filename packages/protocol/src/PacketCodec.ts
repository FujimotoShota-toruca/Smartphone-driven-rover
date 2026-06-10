import type { RoverPacket } from "./types";

export class CodecError extends Error {
  public readonly cause?: unknown;

  public constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "CodecError";
    this.cause = options?.cause;
  }
}

export interface PacketCodec {
  encode(packet: RoverPacket): Uint8Array;
  decode(data: Uint8Array): RoverPacket;
}
