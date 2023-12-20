import { appSources, payloadType } from "../constants";
import { ohMessage } from "../packet-type";
import { OhMyMessageBus } from "./message-bus";

describe('MessageBus', () => {
  let mb: OhMyMessageBus;
  let mbHandler: ohMessage;
  let closeHandler: () => void;
  let message;
  let test: any;

  beforeEach(() => {
    test = null;
    closeHandler = jest.fn();

    mb = new OhMyMessageBus();
    mb.setTrigger((cb: ohMessage) => {
      mbHandler = cb;

      return closeHandler;
    });
  });

  it('should return true on emit new values if callback is present', () => {
    const message = { callback: () => { } };
    const retval = mbHandler(message as any);
    expect(retval).toBeTruthy();
  });

  it('should return false on emit new values without a callback', () => {
    const message = {};
    const retval = mbHandler(message as any);
    expect(retval).toBeFalsy();
  });

  it('should emit new values', () => {
    mb.emitPacket = jest.fn();
    const message = {};
    mbHandler(message as any);
    expect(mb.emitPacket).toHaveBeenCalledWith(message);
  });

  describe('#StreamBySource$', () => {
    it('should emit message with the same source prop', () => {
      const message = {
        packet: { source: appSources.CONTENT }
      };
      let test: any = null;
      mb.streamBySource$([appSources.CONTENT, appSources.POPUP]).subscribe(msg => {
        test = msg;
      });

      mbHandler(message as any);
      expect(test).toBe(message)
    });

    it('should not emit message with a different source prop', () => {
      const message = {
        packet: { source: appSources.CONTENT }
      };
      let test = false;
      mb.streamBySource$(appSources.POPUP).subscribe(msg => {
        test = true;
      });

      mbHandler(message as any);

      expect(test).toBeFalsy();
    });
  });
  describe('#StreamByType$', () => {
    beforeEach(() => {
      message = {
        packet: {
          source: appSources.CONTENT,
          payload: {
            type: payloadType.HIT
          }
        }
      };
    });

    it('should emit message with the matching type/source', () => {
      mb.streamByType$([payloadType.HIT, payloadType.DATA], appSources.CONTENT).subscribe(msg => {
        test = msg;
      });

      mbHandler(message as any);

      expect(test).toEqual(message);
    });

    it('should not emit message with different type', () => {
      message.packet.payload.type = payloadType.ACTIVE;
      mb.streamByType$([payloadType.HIT, payloadType.DATA], appSources.CONTENT).subscribe(msg => {
        test = msg;
      });

      mbHandler(message as any);

      expect(test).toBeNull();
    });
  });

  describe('#StreamById$', () => {
    beforeEach(() => {
      message = {
        packet: {
          source: appSources.POPUP,
          payload: {
            context: { id: 'a' }
          }
        }
      };
    })
    it('should emit message when Id matches', () => {
      mb.streamById$('a', appSources.POPUP).subscribe(msg => {
        test = msg;
      });

      mbHandler(message as any);

      expect(test).toEqual(message);
    });

    it('should not emit message when Id is different', () => {
      mb.streamById$('b', appSources.POPUP).subscribe(msg => {
        test = msg;
      });

      mbHandler(message as any);

      expect(test).toBeNull();
    });

    it('should not emit message when source is different', () => {
      mb.streamById$('a', appSources.CONTENT).subscribe(msg => {
        test = msg;
      });

      mbHandler(message as any);

      expect(test).toBeNull();
    });
  });
});
