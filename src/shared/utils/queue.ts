export type ohPacketType = 'response';

export class OhMyQueue {
  private handlers = {};
  private queue = {};

  addPacket(packet: unknown, packetType: ohPacketType): void {
    if (!this.queue[packetType]) {
      this.queue[packetType] = [];
    }

    this.queue[packetType].push(packet);

    if (this.queue[packetType].length === 1) { // First of type, start!
      this.next(packetType);
    }
  }

  addHandler(packetType: ohPacketType, handler: (packet: unknown) => Promise<void>): void {
    this.handlers[packetType] = async (packet: unknown): Promise<void> => {
      await handler(packet);
      this.queue[packetType].shift();
      this.next(packetType);
    };
  }

  next(packetType: ohPacketType): void {
    if (this.queue[packetType].length) {
      this.handlers[packetType](this.queue[packetType][0]);
    }
  }
}
