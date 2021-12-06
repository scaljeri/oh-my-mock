import { flushPromises } from "../../test-helpers";
import { objectTypes } from "../constants";
import { OhMyQueue,  } from "./queue";

describe('QueueUtils', () => {
  let queue: OhMyQueue;

  beforeEach(() => {
    queue = new OhMyQueue();
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

      expect(queue.getQueue(objectTypes.MOCK).length).toBe(2);
      expect(queue.isHandlerActive(objectTypes.MOCK)).toBeTruthy();

      await flushPromises();

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
});
