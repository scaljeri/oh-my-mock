/**
 * Opt-in NodeJS-SDK server for the test site.
 *
 * The extension's background script connects to `ws://localhost:8000` unless
 * the user says otherwise (`OH_MY_REMOTE_DEFAULTS`), so this server must listen
 * on 8000 to be found. It is a separate process from the main test site on
 * purpose: when it is not running, mocking tests are unaffected by it.
 *
 * **No `port` is passed**, deliberately. That is the documented way to embed
 * the SDK, and `createServer`'s own default used to be 9999 while every other
 * mention of the port in this project said 8000 — so a server started this way
 * listened where no extension would ever look and served nothing, silently.
 * Leaving the port out is what makes `tests/specs/remote-mocking.spec.ts` — and
 * the fixture that polls port 8000 for this process — notice if that comes back.
 *
 * This exercises the real SDK from `libs/nodejs-sdk`, not a stand-in, so that
 * a break in the SDK surfaces here.
 *
 * The SDK imports TypeScript enums from `src/shared`, which Node's plain type
 * stripping cannot handle, so this file needs the transform flag:
 *   node --experimental-transform-types test-site/server/sdk-server.ts
 * The `test-site:sdk` npm script does that for you.
 */

import * as path from 'path';
import { createServer } from '../../libs/nodejs-sdk';
import { ohMyMockStatus } from '../../src/shared/constants';
import type { IOhMyMockResponse } from '../../src/shared/type';

const dataDir = path.join(__dirname, '..', 'sdk-fixtures');

const server = createServer({
  local: { basePath: dataDir },
  listenHandler: () => {
    // eslint-disable-next-line no-console
    console.log('oh-my-mock SDK server listening on the SDK default port');
  }
});

// Served straight from disk, unmodified.
server.local.add({
  url: '/api/users',
  method: 'GET',
  requestType: 'XHR',
  statusCode: 200,
  path: './users-from-sdk.json'
} as never);

// Same file, but rewritten by a handler — proves the handler hook runs.
server.local.add({
  url: '/api/json',
  method: 'GET',
  requestType: 'FETCH',
  statusCode: 200,
  path: './users-from-sdk.json',
  handler: (output: IOhMyMockResponse<string>): IOhMyMockResponse => {
    output.response = JSON.stringify({ source: 'sdk-handler' });
    output.headers = { 'content-type': 'application/json' };
    return output;
  }
} as never);

/**
 * The readiness probe the e2e suite polls — not part of the SDK demo.
 *
 * "Is this process listening?" is answerable over HTTP (`/_sdk/health` below),
 * but that is not the question a test needs answered. What matters is whether
 * the *extension* has finished its websocket handshake, and neither side
 * reports it: `isConnectedWithLocalServer()` lives in a module inside the
 * service worker, and `createServer` keeps its socket.io instance private. So a
 * test asks the only party that can answer — it makes a request from the page
 * and sees whether this server was the one that served it.
 *
 * The path sits outside `/api` on purpose, so the main test server's hit
 * counter ignores the probes that fall through before the socket is up.
 */
server.local.add({
  url: '/sdk-probe',
  method: 'GET',
  statusCode: 200,
  handler: (output: IOhMyMockResponse): IOhMyMockResponse => {
    output.status = ohMyMockStatus.OK;
    output.response = 'sdk-ready';
    output.headers = { 'content-type': 'text/plain' };
    return output;
  }
});

// "Is the process up?", for the fixture that starts it. The SDK's own express
// app is otherwise unused here, so there is nothing to clash with.
server.app.get('/_sdk/health', (_req, res) => {
  res.json({ ok: true });
});
