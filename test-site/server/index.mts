/**
 * Entry point for the test site.
 *
 * Starts two origins:
 *   - the main site        (default :8090) — pages + API
 *   - an alternate origin  (default :8091) — same API with CORS, so
 *     cross-origin mocking can be tested without a second machine
 *
 * Ports below 8090 are avoided on purpose. 8000 must stay free for the NodeJS
 * SDK, which the background script reaches at a hard-coded
 * `ws://localhost:8000` (see `src/background/dispatch-remote.ts`), and 8080 is
 * commonly taken by other local tooling.
 *
 * Run with plain node — no ts-node needed, Node strips the types:
 *   node test-site/server/index.mts --port 8090
 */

import { createApp } from './app.mts';

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const value = Number(process.argv[i + 1]);
  return Number.isFinite(value) ? value : fallback;
}

const port = arg('port', 8090);
const altPort = arg('alt-port', port + 1);

const main = createApp();
main.app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`test-site listening on http://localhost:${port}`);
});

const alt = createApp({ cors: true });
alt.app.listen(altPort, () => {
  // eslint-disable-next-line no-console
  console.log(`test-site (alternate origin) on http://localhost:${altPort}`);
});
