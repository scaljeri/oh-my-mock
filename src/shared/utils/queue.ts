import { objectTypes, payloadType } from "../constants";
import { IPacket } from "../packet-type";

// Callers key the queue with either enum — `background.ts` registers handlers
// by `payloadType`, while the response path uses `objectTypes`. Their string
// values overlap by design, so the alias is the union rather than a claim that
// only one of them is ever used.
export type ohPacketType = objectTypes | payloadType;

interface IOhActivity<T> {
  handler: (packet: IOhQueuePacket<T>) => Promise<void>
  isActive: boolean;
}

interface IOhQueuePacket<T> {
  data: T;
  callback?: (result?: unknown) => void;
}

/**
 * A serial queue per packet type: one handler at a time, the next packet only
 * once the previous one has been processed.
 *
 * Generic over what it carries. The background queue is an `OhMyQueue<IPacket>`
 * and that matters — `addPacket` used to take `unknown`, which let a handler
 * enqueue a bare state object dressed as `{ payload: state }`. It compiled, the
 * state handler then read a map of requests as if it were a state, and wrote it
 * back under an `undefined` domain. Naming the item type is what makes that
 * mistake impossible to write.
 */
export class OhMyQueue<T = IPacket> {
  // Keyed by string rather than by the enum union: `objectTypes.MOCK` and
  // `objectTypes.RESPONSE` share the value 'response', so a Record over the
  // union collapses keys and stops being indexable. The public methods keep the
  // enum type, which is where it helps callers.
  private handlers: Record<string, IOhActivity<T>> = {};
  private queue: Record<string, IOhQueuePacket<T>[]> = {};

  getHandlers(): Partial<Record<ohPacketType, IOhActivity<T>>> {
    return this.handlers;
  }

  getActiveHandlers(): ohPacketType[] {
    return Object.entries(this.handlers).filter(([, v]) => v.isActive)
      .map(([k]) => k) as ohPacketType[];
  }

  getQueue(packetType: ohPacketType): T[] {
    return this.queue[packetType]?.map((p: IOhQueuePacket<T>) => p.data) || [];
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
  addPacket(packetType: ohPacketType, packet: T, callback?: (result?: unknown) => void): Promise<void> {
    if (!this.queue[packetType]) {
      this.queue[packetType] = [];
    }

    this.queue[packetType].push({ data: packet, callback });

    return this.next(packetType);
  }

  async addHandler<P = unknown>(
    packetType: ohPacketType,
    handler: (payload: P) => Promise<unknown>
  ): Promise<void> {
    this.handlers[packetType] = {
      handler: async (packet: IOhQueuePacket<T>): Promise<void> => {
        // Handlers are given the payload, not the whole packet.
        const result = await handler((packet.data as { payload: P }).payload);
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
