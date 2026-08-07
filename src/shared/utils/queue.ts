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
  /**
   * Told about anything a handler or a callback threw.
   *
   * A hook rather than a `throw`, because there is nobody left to throw *to*:
   * the failure happens inside the queue's own turn, and the packet's sender is
   * waiting on a callback, not on this promise. Set it to whatever logs.
   */
  onError?: (packetType: ohPacketType, err: unknown) => void;

  // Keyed by string rather than by the enum union: `objectTypes.MOCK` and
  // `payloadType.RESPONSE` share the value 'response', so a Record over
  // `ohPacketType` collapses keys and stops being indexable. The public methods
  // keep the enum type, which is where it helps callers.
  private handlers: Record<string, IOhActivity<T>> = {};
  private queue: Record<string, IOhQueuePacket<T>[]> = {};
  private idleWaiters: { except?: ohPacketType, resolve: () => void }[] = [];

  getHandlers(): Partial<Record<ohPacketType, IOhActivity<T>>> {
    return this.handlers;
  }

  /**
   * Nothing running and nothing waiting to run.
   *
   * `except` leaves one lane out, for a caller that is itself running in it:
   * the full reset is a RESET packet and asks this while its own lane is, by
   * definition, active — asking without it would be asking to wait for itself.
   *
   * A lane holding packets but with no handler counts as idle. Handlers are all
   * registered while the worker starts, so a packet nobody handles will never
   * run and therefore cannot write anything; counting it would instead mean one
   * stray packet type made the queue permanently busy.
   */
  isIdle(except?: ohPacketType): boolean {
    return !Object.entries(this.handlers).some(([type, activity]) =>
      type !== except && (activity.isActive || !!this.queue[type]?.length));
  }

  /**
   * Resolves the next time `isIdle` holds — immediately if it already does.
   *
   * Nothing here *keeps* the queue idle: a caller that needs the quiet to last
   * has to stop new work arriving itself. `wipe-barrier.ts` is the one that
   * does, and why.
   */
  whenIdle(except?: ohPacketType): Promise<void> {
    if (this.isIdle(except)) {
      return Promise.resolve();
    }

    return new Promise<void>(resolve => this.idleWaiters.push({ except, resolve }));
  }

  private settleIdle(): void {
    if (!this.idleWaiters.length) {
      return;
    }

    // Each waiter judged against its own exclusion, so two waiters excluding
    // different lanes cannot resolve each other's.
    this.idleWaiters = this.idleWaiters.filter(waiter => {
      if (!this.isIdle(waiter.except)) {
        return true;
      }

      waiter.resolve();

      return false;
    });
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
      /**
       * Runs one packet and then, whatever happened, moves on.
       *
       * This used to be four statements in a row, and each ordering mistake in
       * it cost something:
       *
       * - A rejecting handler never reached `isActive = false`, so the lane was
       *   dead for the rest of the service worker's life and every sender
       *   waiting on it hung. Two registered handlers do a storage read outside
       *   their own `try`, so it was reachable.
       * - The packet was shifted *after* the callback ran. A callback that
       *   threw — `sendResponse` on a channel whose popup has just closed —
       *   left the head packet in place with the lane already free, so the next
       *   arrival processed the same packet again.
       * - A rejection skipped `packet.callback` entirely, and
       *   `chrome.runtime.sendMessage` has no timeout, so that sender waited
       *   for ever.
       */
      handler: async (packet: IOhQueuePacket<T>): Promise<void> => {
        // Off the queue before it runs, not after: a packet that fails must not
        // be retried for ever.
        this.queue[packetType].shift();

        let result: unknown;

        try {
          // Handlers are given the payload, not the whole packet.
          result = await handler((packet.data as { payload: P }).payload);
        } catch (err) {
          this.onError?.(packetType, err);
        } finally {
          this.handlers[packetType].isActive = false;
        }

        try {
          // Always, even after a failure. `undefined` is what a sender gets for
          // a message nobody handled, and that is the truth here.
          packet.callback?.(result);
        } catch (err) {
          this.onError?.(packetType, err);
        }

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
      // The handler wrapper calls this once a packet is done and its lane has
      // been freed, so this branch is where a lane running dry is noticed —
      // which is the only moment the queue can newly *become* idle.
      this.settleIdle();

      return;
    }

    this.handlers[packetType].isActive = true;
    return this.handlers[packetType].handler(this.queue[packetType][0]);
  }
}
