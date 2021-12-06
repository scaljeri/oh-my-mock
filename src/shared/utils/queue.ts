import { objectTypes } from "../constants";
import { IPacket } from "../packet-type";

export type ohPacketType = objectTypes;

interface IOhActivity {
  handler: (packet: IOhQueuePacket) => Promise<void>
  isActive: boolean;
}

interface IOhQueuePacket<T = IPacket> {
  data: T;
  callback(result?: unknown): void;
}

export class OhMyQueue {
  private handlers: Partial<Record<ohPacketType, IOhActivity>> = {};
  private queue: Partial<Record<ohPacketType, IOhQueuePacket[]>> = {};

  getHandlers(): Partial<Record<ohPacketType, IOhActivity>> {
    return this.handlers;
  }

  getActiveHandlers(): ohPacketType[] {
    return Object.entries(this.handlers).filter(([k, v]) => v.isActive)
      .map(([k]) => k) as ohPacketType[];
  }

  getQueue<T = unknown>(packetType: string): T[] {
    return this.queue[packetType]?.map(p => p.data) as T[] || [];
  }

  removeFirstPacket(type: ohPacketType): void {
    this.queue[type].shift();
  }

  resetHandler(packetType: ohPacketType): void {
    if (packetType && this.handlers[packetType]) {
      this.handlers[packetType].isActive = false;
      this.next(packetType);
    }
  }

  isHandlerActive(packetType: ohPacketType): boolean {
    return this.handlers[packetType]?.isActive || false;
  }

  hasHandler(packetType: string): boolean {
    return !!this.handlers[packetType]?.handler;
  }

  // The `callback` is called as soon as the packet has been processed
  addPacket(packetType: string, packet: unknown, callback?: (result?: unknown) => void): void {
    if (!this.queue[packetType]) {
      this.queue[packetType] = [];
    }

    this.queue[packetType].push({ data: packet, callback });
    this.next(packetType);
  }

  addHandler(packetType: string, handler: (packet: any) => Promise<unknown>): void {
    this.handlers[packetType] = {
      handler: async (packet: any): Promise<void> => {
        const result = await handler(packet.data.payload); // process packet
        this.handlers[packetType].isActive = false;
        packet.callback?.(result);
        this.queue[packetType].shift();

        this.next(packetType);
      }, isActive: false
    };

    this.next(packetType);
  }

  next(packetType: string): void {
    if (
      !this.hasHandler(packetType) ||
      !this.getQueue(packetType).length ||
      this.handlers[packetType].isActive
    ) {
      return;
    }

    this.handlers[packetType].isActive = true;
    this.handlers[packetType].handler(this.queue[packetType][0]);
  }
}
