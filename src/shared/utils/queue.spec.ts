import { flushPromises } from "../../test-helpers";
import { OhMyQueue } from "./queue";

describe('StoreUtils', () => {
  let queue: OhMyQueue;

  beforeEach(() => {
    queue = new OhMyQueue();
  });

  it('should add a handler', () => {
    queue.addHandler('response', () => Promise.resolve());

    expect(queue.hasHandler('response')).toBeTruthy();
  })

  it('should not be active initially', () => {
    expect(queue.isHandlerActive('response')).toBeFalsy();
  });

  describe('With queue', () => {
    beforeEach(() => {
      queue.addPacket('response', 'foo');
      queue.addPacket('response', 'bar');
    });

    it('should have a packet on the queue', () => {
      expect(queue.getQueue('response')).toEqual(['foo', 'bar']);
    });

    it('should not have any handlers', () => {
      expect(queue.hasHandler('response')).toBeFalsy();
    });

    it('should handle packets in the queue', (done) => {
      const packets = ['foo', 'bar'];
      const handler = (packet: any): Promise<void> => {
        expect(packet).toBe(packets.shift());

        setTimeout(() => {
          if (queue.getQueue('response').length === 0) {
            expect(queue.isHandlerActive('response')).toBeFalsy();
            done();
          }
        });

        return Promise.resolve();
      };
      queue.addHandler('response', handler);
      expect(queue.hasHandler('response')).toBeTruthy();
    });

    it('should not activate two handlers', async () => {
      const handler = jest.fn().mockResolvedValue(null);
      queue.addHandler('response', handler);

      expect(queue.getQueue('response').length).toBe(1);
      expect(queue.isHandlerActive('response')).toBeTruthy();

      await flushPromises();

      expect(handler).toHaveBeenCalledTimes(2);
      expect(queue.getQueue('response').length).toBe(0);
    });
  });
});
