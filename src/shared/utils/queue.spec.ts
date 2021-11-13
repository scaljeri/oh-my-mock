import { OhMyQueue } from "./queue";

describe('StoreUtils', () => {
  let queue: OhMyQueue;

  beforeEach(() => {
    queue = new OhMyQueue();
    queue.addPacket('response', 'foo');
    queue.addPacket('response', 'bar');
  });

  it('should have a packet on the queue', () => {
    expect(queue.getInQueue('response')).toEqual(['foo', 'bar']);
  });

  it('should not have any handlers', () => {
    expect(queue.hasHandler('response')).toBeFalsy();
  })

  it('should handle packets in the queue', (done) => {
    const packets = ['foo', 'bar'];
    const handler = (packet: any): Promise<void> => {
      expect(packet).toBe(packets.shift());

      setTimeout(() => {
        if (queue.getInQueue('response').length === 0) {
          expect(queue.isHandlerActive('response')).toBeFalsy();
          done();
        }
      });

      return Promise.resolve();
    };
    queue.addHandler('response', handler);
    expect(queue.hasHandler('response')).toBeTruthy();
  });
});
