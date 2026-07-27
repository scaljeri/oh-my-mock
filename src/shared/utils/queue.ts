import { objectTypes, payloadType } from "../constants";
import { IPacket } from "../packet-type";

// Callers key the queue with either enum — `background.ts` registers handlers
// by `payloadType`, while the response path uses `objectTypes`. Their string
// values overlap by design, so the alias is the union rather than a claim that
// only one of them is ever used.
export type ohPacketType = objectTypes | payloadType;

interface IOhActivity {
  handler: (packet: IOhQueuePacket) => Promise<void>
  isActive: boolean;
}

interface IOhQueuePacket<T = IPacket> {
  data: T;
  callback(result?: unknown): void;
}

export class OhMyQueue {
  // Keyed by string rather than by the enum union: `objectTypes.MOCK` and
  // `objectTypes.RESPONSE` share the value 'response', so a Record over the
  // union collapses keys and stops being indexable. The public methods keep the
  // enum type, which is where it helps callers.
  private handlers: Record<string, IOhActivity> = {};
  private queue: Record<string, IOhQueuePacket[]> = {};

  getHandlers(): Partial<Record<ohPacketType, IOhActivity>> {
    return this.handlers;
  }

  getActiveHandlers(): ohPacketType[] {
    return Object.entries(this.handlers).filter(([k, v]) => v.isActive)
      .map(([k]) => k) as ohPacketType[];
  }

  getQueue<T = unknown>(packetType: ohPacketType): T[] {
    return this.queue[packetType]?.map((p: IOhQueuePacket) => p.data) as T[] || [];
  }

  removeFirstPacket(type: ohPacketType): void {
    this.queue[type]?.shift();
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

  hasHandler(packetType: ohPacketType): boolean {
    return !!this.handlers[packetType]?.handler;
  }

  // The `callback` is called as soon as the packet has been processed
  addPacket(packetType: ohPacketType, packet: unknown, callback?: (result?: unknown) => void): Promise<void> {
    if (!this.queue[packetType]) {
      this.queue[packetType] = [];
    }

    this.queue[packetType].push({ data: packet, callback } as IOhQueuePacket);

    return this.next(packetType);
  }

  async addHandler(packetType: ohPacketType, handler: (packet: any) => Promise<unknown>): Promise<void> {
    this.handlers[packetType] = {
      handler: async (packet: any): Promise<void> => {
        const result = await handler(packet.data.payload); // process packet
        this.handlers[packetType].isActive = false;
        packet.callback?.(result);
        this.queue[packetType].shift();

        return this.next(packetType);
      }, isActive: false
    };

    return this.next(packetType);
  }

  async next(packetType: ohPacketType): Promise<void> {
    if (
      !this.hasHandler(packetType) ||
      !this.getQueue(packetType).length ||
      this.handlers[packetType].isActive
    ) {
      return;
    }

    this.handlers[packetType].isActive = true;
    return this.handlers[packetType].handler(this.queue[packetType][0]);
  }
}
