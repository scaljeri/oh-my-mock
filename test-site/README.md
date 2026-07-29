# Test site

The fixture the OhMyMock e2e suite runs against, and a page you can drive by
hand while developing.

## Running it

```bash
npm run test-site          # http://localhost:8090  (+ :8091 alternate origin)
```

No build step and no `ts-node` — Node strips the TypeScript itself, which is
why the server files use the `.mts` extension.

The Playwright suite starts this automatically (see `webServer` in
`playwright.config.ts`), so you only need to run it by hand for manual testing.

### The SDK server (opt-in)

```bash
npm run test-site:sdk      # ws://localhost:8000
```

Separate process, separate port, started only when you want to exercise the
NodeJS SDK path. The extension's background script connects to a hard-coded
`ws://localhost:8000` (`src/background/dispatch-remote.ts`), which is why 8000
is kept free and why the main site sits on 8090: a plain mocking test should
never accidentally be talking to the SDK.

This one does go through `ts-node` (hence `.ts`, not `.mts`). The SDK imports
TypeScript enums from `src/shared`, and Node's native support only *erases*
types — it cannot compile an enum into the runtime object one needs.

## Layout

```
server/
  index.mts      entry point, starts both origins
  app.mts        express app factory (no listen — mountable in tests)
  routes.mts     the test API + the hit counter
  fixtures.mts   deterministic payloads
public/
  index.html     the page
  harness.js     window.harness — the request driver tests call
  ui.js          controls and result table, for manual use only
```

## The two things that make it testable

**Deterministic payloads.** Every API response is fixed bytes and carries an
`x-oh-my-source: server` header. A mocked response cannot have that header, so
"did this come from the server or from OhMyMock?" is never a guess.

**A hit counter.** `/api/*` requests are counted per endpoint and exposed at
`GET /_harness/stats`; `POST /_harness/reset` clears it. This is what proves the
negative — a mocked request must leave the count at zero. Asserting on the body
alone would still pass if the extension fetched the real response and threw it
away.

The `/_harness/*` endpoints sit outside `/api` on purpose: they are never
counted and never mocked.

## `window.harness`

The page exposes one function that normalises XHR and fetch to the same result
shape, so a test asserts on behaviour rather than on transport quirks:

```js
const result = await window.harness.request({
  transport: 'fetch',      // or 'xhr'
  method: 'GET',
  url: '/api/json',
  responseType: 'json',    // text | json | blob | arraybuffer
  body: undefined,
  headers: {}
});
// -> { status, ok, headers, body, json, base64, byteLength, durationMs, error, ... }
```

Binary bodies come back base64-encoded so they survive `page.evaluate()`.

It never throws: a network failure is a result with `error` set, which makes
failure modes as easy to assert as successes.

One rule when editing `harness.js`: always call `window.fetch` and
`window.XMLHttpRequest` live. OhMyMock works by patching them, so caching a
reference at load time would silently test the unpatched originals.

## Endpoints

| Endpoint | What it is for |
| --- | --- |
| `/api/json`, `/api/users` | JSON bodies |
| `/api/text`, `/api/html` | text/plain and text/html |
| `/api/image.png`, `.gif`, `.svg` | image mime types |
| `/api/binary` | `application/octet-stream`, 256 known bytes |
| `/api/large?kb=512` | large payloads |
| `/api/echo` | echoes method, headers, query and body |
| `/api/status/:code` | any status code |
| `/api/delay/:ms` | slow responses |
| `/api/headers` | custom response headers |
| `/api/redirect`, `/api/redirect-chain` | 302 handling |
| `/api/cookie` | sets one httpOnly cookie |
| `/api/cookies/set` | sets the whole fixture spread (see below) |
| `/api/cookies` | the cookies the browser sent, **in order**, plus the raw header |
| `/api/cookies/clear` | expires the fixture cookies |
| `/api/admin/whoami` | a sub-path endpoint, for the path-scoped cookie |
| `/api/abort` | drops the socket, no reply |

## Pages

| Path | What it is for |
| --- | --- |
| `/` | the harness page, no CSP |
| `/csp-strict` | `script-src 'self'` — exercises the CSP-removal fallback in `src/content/inject-code.ts` |
| `/csp-report-only` | CSP in report-only mode; injection must be unaffected |

Port 8091 serves the same API with permissive CORS, for cross-origin cases.

## Cookies

`/api/cookies/set` hands out a spread rather than one of each, because cookie
mocking has to carry `httpOnly`, `secure`, `sameSite`, `path` and an expiry all
the way through storage, the jar and back — and the recorder has to pick each of
them off a real `Set-Cookie`. The fixtures live in `server/fixtures.mts`:

| Cookie | Path | Why it is there |
| --- | --- | --- |
| `ohMySession` | `/` | the common case: httpOnly session cookie, what a login sets |
| `ohMyVisible` | `/` | readable from `document.cookie` — flags are per mock, not global |
| `ohMyPersistent` | `/` | has an expiry, so "recorded as a session cookie" is visible |
| `ohMySession` | `/api/admin` | **same name, deeper path** |

That last one is not padding. `chrome.cookies.get` matches *parent* paths while
`set` does not, and a mock on `/api/admin` used to record the `/` cookie as the
one it displaced — then on unapply rewrote that untouched cookie and left itself
in place, surviving every way of switching it off.

So `/api/cookies` answers with a **list**, not a map: a map cannot hold the same
name twice and would quietly drop one of them. RFC 6265 has the client send the
longer path first, which is why `/api/admin/whoami` reports the sub-path value
as `session` and still exposes the full list beside it.
