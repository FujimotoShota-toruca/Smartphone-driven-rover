import type { RoverPacket } from "@smartphone-rover/protocol";

import type { RoverTransport } from "../transport/RoverTransport";

export interface HeartbeatWriteAwareTransport extends RoverTransport {
  isWriteInProgress?(): boolean;
}

export interface SendHeartbeatIfIdleOptions {
  transport: HeartbeatWriteAwareTransport;
  packet: RoverPacket;
  inFlight: { current: boolean };
}

export async function sendHeartbeatIfIdle({
  transport,
  packet,
  inFlight,
}: SendHeartbeatIfIdleOptions): Promise<boolean> {
  if (inFlight.current || transport.isWriteInProgress?.()) {
    return false;
  }

  inFlight.current = true;
  try {
    await transport.send(packet);
    return true;
  } finally {
    inFlight.current = false;
  }
}
