export type ohPacketType = 'response';

interface IOhActivity {
  handler: (packet: unknown) => Promise<void>
  isActive: boolean;
}

export class OhMyQueue {
  private handlers: Partial<Record<ohPacketType, IOhActivity>> = {};
  private queue: Partial<Record<ohPacketType, unknown[]>> = {};

  getQueue<T = unknown>(packetType: ohPacketType): T[] {
    return this.queue[packetType] as T[] || [];
  }

  isHandlerActive(packetType: ohPacketType): boolean {
    return this.handlers[packetType]?.isActive || false;
  }

  hasHandler(packetType: ohPacketType): boolean {
    return !!this.handlers[packetType]?.handler;
  }

  addPacket(packetType: ohPacketType, packet: unknown): void {
    if (!this.queue[packetType]) {
      this.queue[packetType] = [];
    }

    this.queue[packetType].push(packet);
    this.next(packetType);
  }

  addHandler(packetType: ohPacketType, handler: (packet: unknown) => Promise<void>): void {
    this.handlers[packetType] = {
      handler: async (packet: unknown): Promise<void> => {
        await handler(packet);          // process packet
        this.handlers[packetType].isActive = false;
        this.next(packetType);          // next
      }, isActive: false
    };

    this.next(packetType);
  }

  next(packetType: ohPacketType): void {
    if (
      !this.hasHandler(packetType) ||
      !this.getQueue(packetType).length ||
      this.handlers[packetType].isActive
      ) {
      return;
    }

    this.handlers[packetType].isActive = true;
    this.handlers[packetType].handler(this.queue[packetType].shift());
  }
}
