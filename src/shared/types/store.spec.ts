import { OH_MY_REMOTE_DEFAULTS } from './store';

/**
 * The address a user who has stored nothing gets offered.
 *
 * This used to be pinned from the other end — `test-site/server/sdk-server.ts`
 * passed no port, so the e2e fixture polling 8000 was an independent statement
 * that the SDK and the extension agreed. That stopped being possible once the
 * suite started naming a port per run, which it has to: 8000 is one number on
 * one machine, and two runs cannot share it.
 *
 * So the agreement is asserted here instead, against the constant both sides
 * read. It is a real guard: `createServer` defaulted to **9999** for a long
 * time while `server.ts` passed 8000 and this constant said 8000, so embedding
 * the SDK the documented way — `createServer` with no port — produced a server
 * listening where no extension would ever look, serving nothing, silently.
 */
describe('OH_MY_REMOTE_DEFAULTS', () => {
  it('offers the port the SDK listens on when nobody names one', () => {
    expect(OH_MY_REMOTE_DEFAULTS.port).toBe(8000);
    expect(OH_MY_REMOTE_DEFAULTS.host).toBe('localhost');
  });

  /** Nothing is dialled until the Remote-mocking page says otherwise. */
  it('leaves this browser as the source', () => {
    expect(OH_MY_REMOTE_DEFAULTS.target).toBe('extension');
  });
});
