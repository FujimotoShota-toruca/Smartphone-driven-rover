#include "PacketHandler.h"

namespace rover {

PacketHandler::PacketHandler(PacketHandlerState state, PacketHandlerLimits limits,
                             EstopLatch& estopLatch,
                             HeartbeatWatchdog& heartbeatWatchdog,
                             MotorDriver& motor, Stream* debugStream)
    : state_(state),
      limits_(limits),
      estopLatch_(estopLatch),
      heartbeatWatchdog_(heartbeatWatchdog),
      motor_(motor),
      debugStream_(debugStream) {}

PacketHandleResult PacketHandler::handle(const RoverPacket& packet,
                                         uint32_t nowMs) {
  switch (packet.type) {
    case RoverMessageType::CmdVel:
      state_.activeCmdVel = packet.cmdVel;
      state_.activeCmdReceivedAtMs = nowMs;
      state_.hasActiveCmdVel = true;
      return accept(packet, "cmd_vel accepted");
    case RoverMessageType::EmergencyStop:
      estopLatch_.trigger();
      return accept(packet, "emergency_stop latched");
    case RoverMessageType::Heartbeat:
      heartbeatWatchdog_.markHeartbeat(nowMs);
      return accept(packet, "heartbeat accepted");
    case RoverMessageType::ResetEstop:
      estopLatch_.clear();
      motor_.stop();
      return accept(packet, "reset_estop accepted");
    case RoverMessageType::PrintStatus:
      state_.nextStatusAtMs = nowMs;
      return accept(packet, "status requested");
    case RoverMessageType::SetStatusInterval:
      if (packet.statusIntervalMs == 0) {
        state_.statusIntervalMs = 0;
        state_.nextStatusAtMs = 0;
        if (debugStream_) {
          debugStream_->println("status periodic off");
        }
        return accept(packet, "status periodic disabled");
      }

      if (packet.statusIntervalMs < limits_.minStatusIntervalMs ||
          packet.statusIntervalMs > limits_.maxStatusIntervalMs) {
        if (debugStream_) {
          debugStream_->print("status interval rejected ms=");
          debugStream_->print(packet.statusIntervalMs);
          debugStream_->print(" allowed=");
          debugStream_->print(limits_.minStatusIntervalMs);
          debugStream_->print("..");
          debugStream_->println(limits_.maxStatusIntervalMs);
        }
        return reject(packet, "status interval out of range");
      }

      state_.statusIntervalMs = packet.statusIntervalMs;
      state_.nextStatusAtMs = nowMs;
      if (debugStream_) {
        debugStream_->print("status periodic ms=");
        debugStream_->println(state_.statusIntervalMs);
      }
      return accept(packet, "status periodic enabled");
    case RoverMessageType::None:
    case RoverMessageType::Ack:
    case RoverMessageType::Reject:
    case RoverMessageType::PicoHk:
    case RoverMessageType::SafetyState:
      return reject(packet, "packet type is not a command");
  }

  return reject(packet, "unknown packet type");
}

PacketHandleResult PacketHandler::accept(const RoverPacket& packet,
                                         const char* reason) const {
  PacketHandleResult result;
  result.accepted = true;
  result.ackRequired = true;
  result.reason = reason;
  result.response = createAck(packet);
  return result;
}

PacketHandleResult PacketHandler::reject(const RoverPacket& packet,
                                         const char* reason) const {
  PacketHandleResult result;
  result.accepted = false;
  result.ackRequired = true;
  result.reason = reason;
  result.response = createReject(packet);
  return result;
}

RoverPacket PacketHandler::createAck(const RoverPacket& packet) const {
  RoverPacket ack;
  ack.type = RoverMessageType::Ack;
  ack.seq = packet.seq;
  ack.relatedSeq = packet.seq;
  ack.reason = "accepted";
  return ack;
}

RoverPacket PacketHandler::createReject(const RoverPacket& packet) const {
  RoverPacket reject;
  reject.type = RoverMessageType::Reject;
  reject.seq = packet.seq;
  reject.relatedSeq = packet.seq;
  reject.reason = "rejected";
  return reject;
}

}  // namespace rover
