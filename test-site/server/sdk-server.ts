/**
 * Opt-in NodeJS-SDK server for the test site.
 *
 * The extension dials whatever the Remote-mocking page stored
 * (`remoteUrl(store.remote)`), falling back to `OH_MY_REMOTE_DEFAULTS` — port
 * 8000 — only when nothing has been. So this server takes `--port` and the
 * suite gives it one per run, seeding the same address on the store: two runs
 * on one machine no longer fight over a single port, and `sdk.spec.ts` can
 * still test the case where nothing is listening at all.
 *
 * Without `--port` it takes `createServer`'s own default, which is the
 * documented way to embed the SDK. That default used to be 9999 while every
 * other mention of the port in this project said 8000, so a server started
 * that way listened where no extension would look and served nothing,
 * silently. `libs/nodejs-sdk/index.spec.ts` pins it now — the e2e cannot, now
 * that it names a port.
 *
 * It is a separate process from the main test site on purpose: when it is not
 * running, mocking tests are unaffected by it.
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

const portArg = process.argv.indexOf('--port');
// Absent means "take the SDK's own default", which is a case worth being able
// to start by hand; the suite always names one.
const port = portArg === -1 ? undefined : Number(process.argv[portArg + 1]);

const server = createServer({
  local: { basePath: dataDir },
  ...(port !== undefined && { port }),
  listenHandler: () => {
    // eslint-disable-next-line no-console
    console.log(
      `oh-my-mock SDK server listening on ${port ?? 'the SDK default port'}`
    );
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
