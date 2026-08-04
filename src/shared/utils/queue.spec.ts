import { flushPromises } from "../../test-helpers";
import { objectTypes, payloadType } from "../constants";
import { OhMyQueue,  } from "./queue";

describe('QueueUtils', () => {
  let queue: OhMyQueue<string>;

  beforeEach(() => {
    queue = new OhMyQueue<string>();
  });

  it('should add a handler', () => {
    queue.addHandler(objectTypes.MOCK, () => Promise.resolve());

    expect(queue.hasHandler(objectTypes.MOCK)).toBeTruthy();
  })

  it('should not be active initially', () => {
    expect(queue.isHandlerActive(objectTypes.MOCK)).toBeFalsy();
  });

  describe('With queue', () => {
    beforeEach(() => {
      queue.addPacket(objectTypes.MOCK, 'foo');
      queue.addPacket(objectTypes.MOCK, 'bar');
    });

    it('should have a packet on the queue', () => {
      expect(queue.getQueue(objectTypes.MOCK)).toEqual(['foo', 'bar']);
    });

    it('should not have any handlers', () => {
      expect(queue.hasHandler(objectTypes.MOCK)).toBeFalsy();
    });

    it('should handle packets in the queue', () => {
      const packets = ['foo', 'bar'];
      const handler = (packet: any): Promise<void> => {
        // expect(packet).toBe(packets.shift());

        // setTimeout(() => {
        //   if (queue.getQueue(objectTypes.MOCK).length === 0) {
        //     expect(queue.isHandlerActive(objectTypes.MOCK)).toBeFalsy();
        //     done();
        //   }
        // });

        return Promise.resolve();
      };
      queue.addHandler(objectTypes.MOCK, handler);
      expect(queue.hasHandler(objectTypes.MOCK)).toBeTruthy();
    });

    it('should not activate two handlers', async () => {
      const handler = jest.fn().mockResolvedValue(null);
      queue.addHandler(objectTypes.MOCK, handler);

      // One, not two: a packet is taken off the queue when it starts, so this
      // is the one still *waiting* while the first runs. It used to come off
      // after the handler and its callback had both finished, which meant a
      // callback that threw left it at the head with the lane already free —
      // and the next arrival processed it a second time.
      expect(queue.getQueue(objectTypes.MOCK).length).toBe(1);
      expect(queue.isHandlerActive(objectTypes.MOCK)).toBeTruthy();

      await flushPromises();

      // Both ran, exactly once each, which is what the name of this test is
      // about.
      expect(handler).toHaveBeenCalledTimes(2);
      expect(queue.getQueue(objectTypes.MOCK).length).toBe(0);
    });
  });

  describe('Packet with callback', () => {
    let doneA = 0;
    let doneB = 0;
    let count = 0;

    beforeEach(() => {
      queue.addPacket(objectTypes.MOCK, 'foo', () => doneA = ++count);
      queue.addPacket(objectTypes.MOCK, 'bar', () => doneB = ++count);
      queue.addHandler(objectTypes.MOCK, () => Promise.resolve());
    });

    it('should trigger callbacks in the right order', () => {
      expect(doneA).toBe(1);
      expect(doneB).toBe(2);
    });
  });

  /**
   * A lane has to survive its own handler failing.
   *
   * The wrapper used to be four statements in a row. A rejecting handler never
   * reached `isActive = false`, so the lane was dead for the rest of the
   * service worker's life and every sender waiting on it hung — reachable,
   * because two registered handlers do a storage read outside their own `try`.
   */
  describe('when a handler fails', () => {
    it('keeps the lane running for the packets behind it', async () => {
      const queue = new OhMyQueue<{ payload: string }>();
      const seen: string[] = [];

      await queue.addHandler<string>(payloadType.STATE, async (payload) => {
        seen.push(payload);

        if (payload === 'boom') {
          throw new Error('handler blew up');
        }

        return payload;
      });

      await queue.addPacket(payloadType.STATE, { payload: 'boom' });
      await queue.addPacket(payloadType.STATE, { payload: 'after' });

      expect(seen).toEqual(['boom', 'after']);
      expect(queue.isHandlerActive(payloadType.STATE)).toBe(false);
      expect(queue.getQueue(payloadType.STATE)).toEqual([]);
    });

    /**
     * `chrome.runtime.sendMessage` has no timeout, so a sender whose callback
     * is skipped waits for ever. `undefined` is what it would get for a message
     * nobody handled, which is the truth here.
     */
    it('still answers the sender', async () => {
      const queue = new OhMyQueue<{ payload: string }>();
      const answers: unknown[] = [];

      await queue.addHandler<string>(payloadType.STATE, async () => {
        throw new Error('handler blew up');
      });

      await queue.addPacket(payloadType.STATE, { payload: 'x' }, (result) =>
        answers.push(result)
      );

      expect(answers).toEqual([undefined]);
    });

    it('reports which lane it was, rather than leaving it to be guessed', async () => {
      const queue = new OhMyQueue<{ payload: string }>();
      const failures: unknown[][] = [];
      queue.onError = (type, err) => failures.push([type, err]);

      await queue.addHandler<string>(payloadType.STATE, async () => {
        throw new Error('handler blew up');
      });
      await queue.addPacket(payloadType.STATE, { payload: 'x' });

      expect(failures).toHaveLength(1);
      expect(failures[0][0]).toBe(payloadType.STATE);
      expect((failures[0][1] as Error).message).toBe('handler blew up');
    });

    it('does not reject, so nothing upstream has to guess either', async () => {
      const queue = new OhMyQueue<{ payload: string }>();

      await queue.addHandler<string>(payloadType.STATE, async () => {
        throw new Error('handler blew up');
      });

      await expect(
        queue.addPacket(payloadType.STATE, { payload: 'x' })
      ).resolves.toBeUndefined();
    });
  });

  /**
   * The packet was shifted *after* the callback ran. A callback that threw —
   * `sendResponse` on a channel whose popup has just closed — left the head
   * packet in place with the lane already free, so the next arrival processed
   * the same packet a second time.
   */
  it('does not process a packet twice when its callback throws', async () => {
    const queue = new OhMyQueue<{ payload: string }>();
    const seen: string[] = [];

    await queue.addHandler<string>(payloadType.STATE, async (payload) => {
      seen.push(payload);

      return payload;
    });

    await queue.addPacket(payloadType.STATE, { payload: 'first' }, () => {
      throw new Error('the popup went away');
    });
    await queue.addPacket(payloadType.STATE, { payload: 'second' });

    expect(seen).toEqual(['first', 'second']);
  });
});
