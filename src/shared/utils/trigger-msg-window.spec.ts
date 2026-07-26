import { triggerWindow } from './trigger-msg-window';

/**
 * `window.postMessage` is a public channel. These tests pin down that only
 * messages from this same window are accepted, so a script in the page, an
 * iframe or an opener cannot impersonate the injected script and drive the
 * content script.
 */
describe('triggerWindow', () => {
  let received: unknown[];
  let off: () => void;

  function post(init: Partial<MessageEventInit> & { data: unknown }): void {
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        source: window,
        ...init
      })
    );
  }

  const packet = { source: 'injected', payload: { type: 'api-request' } };

  beforeEach(() => {
    received = [];
    off = triggerWindow((message) => {
      received.push(message.packet);
      return false;
    });
  });

  afterEach(() => off());

  it('accepts a message from its own window and origin', () => {
    post({ data: packet });

    expect(received).toEqual([packet]);
  });

  it('ignores a message from another frame', () => {
    // What an iframe or an opener posting to this window looks like: the data
    // is indistinguishable from the real thing, only the source differs.
    post({ data: packet, source: { postMessage: () => undefined } as any });

    expect(received).toEqual([]);
  });

  it('ignores a message from a foreign origin', () => {
    post({ data: packet, origin: 'https://attacker.example' });

    expect(received).toEqual([]);
  });

  it('stops listening once unsubscribed', () => {
    off();

    post({ data: packet });

    expect(received).toEqual([]);
  });
});
