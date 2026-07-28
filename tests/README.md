# E2E tests

Playwright, driving the real extension in a real Chromium against the local
[test site](../test-site/README.md).

## Running

```bash
npm run build           # full extension, including the Angular popup
npm run e2e             # headless
npm run e2e:headed      # watch it in a window
npm run e2e:debug       # Playwright inspector
npm run e2e:report      # open the last HTML report
npm run e2e:types       # type-check the suite
```

`e2e:types` exists because Playwright transpiles specs without checking them,
and neither of the two project tsconfigs covers this directory. Without it the
suite is the one unchecked corner of a strict codebase.

`npm run build:bundles` is a faster alternative that compiles only the five
webpack bundles (content, injected, early-inject, sandbox, background) plus the
manifest and icons — about ten seconds instead of a minute. Everything except
`popup.spec.ts` passes against it, since those tests need the Angular build.

The test site is started for you by `webServer` in `playwright.config.ts`.

## No display needed

Chrome extensions need a browser with an extension host, which plain
`headless: true` does not provide. The fixture launches with `headless: false`
plus the `--headless=new` flag instead: Chrome's newer headless mode runs
extensions, needs no X server, and works on CI and on a Raspberry Pi alike.

## How a test drives the extension

Mocks are seeded straight into `chrome.storage` from the extension's service
worker, rather than by clicking through the popup. That keeps these tests
focused on the part that does the intercepting — the content and injected
scripts — instead of turning every one of them into an Angular UI test.

```ts
test('a mocked response replaces the real one', async ({ ohMy, site, server }) => {
  await ohMy.seedMock({ domain: SITE_DOMAIN, url: '/api/json', response: { source: 'mock' } });
  await ohMy.setActive(SITE_DOMAIN);

  await site.open();
  await site.waitForInjection();

  const result = await site.request({ url: '/api/json', responseType: 'json' });

  expect(result.json.source).toBe('mock');
  expect(await server.hitCount('GET /api/json')).toBe(0);   // never left the browser
});
```

Always assert the hit count as well as the body. Checking the body alone would
pass even if the extension fetched the real response and discarded it.

### Fixtures

| Fixture | What it gives you |
| --- | --- |
| `ohMy` | seed mocks and cookie mocks, activate domains, read state and the browser's cookie jar (`tests/fixtures/oh-my-mock.ts`) |
| `site` | the page, plus `request()` and `waitForInjection()` |
| `server` | the test server's hit counter |
| `serviceWorker`, `extensionId`, `context` | the raw Playwright handles |

Two helpers are not fixtures because only a few specs need them:
`openPopup()` (`tests/fixtures/popup.ts`) and `SdkServer`
(`tests/fixtures/sdk-server.ts`).

### Opening the popup

Some behaviour only exists while the popup is open — see the sandbox section
below. Playwright cannot press the toolbar button, which is where the popup
normally learns which tab it is inspecting, so `openPopup()` passes `domain` and
`tabId` on the query string instead. `src/app/app.initialize.ts` reads them from
there, exactly as the toolbar does.

The tab id is load-bearing, not cosmetic: `ContentService` drops every message
whose `sender.tab.id` is not the one it was opened for, and answers with
`chrome.tabs.sendMessage(tabId, ...)`. Give it the wrong id and the popup looks
perfectly alive while mocking nothing.

### Cookies

`cookies.spec.ts` is the one part of the suite that asserts against the browser
rather than against the page, because that is the only thing a cookie mock
produces: `chrome.cookies` in the service worker is both how the extension
writes them and how a test reads them back. Reading them from the page would be
asserting the opposite of the design — an `httpOnly` mock is meant to be
invisible there, and the extension never strips the flag to make itself work.

Three things shape how those tests are written:

**Nothing is called; storage is written.** `cookie-sync.ts` syncs on
`chrome.storage.onChanged`, so seeding a mock, flipping a preset or switching
the domain off are all just writes, and the jar catches up an event later in a
service worker that may have to wake up first. Every cookie assertion is
therefore an `expect.poll`, never a read straight after a write.

**A negative needs a barrier.** "This cookie was not touched" has nothing to
poll for. `syncCookies` walks a domain's mocks in one pass, so a second, enabled
mock riding along in the same pass gives the poll something to wait for; once
its effect is visible, the pass that ignored the other mock is over.

**The jar is per profile, so it cleans itself up.** Cookies are browser-global,
but each test gets its own Chrome profile, which is also what keeps a mocked
session out of the next spec.

Two behaviours are worth knowing before changing anything here: switching a mock
off **restores** the cookie it displaced rather than deleting it (deleting would
log the developer out of the site they were testing), and a mock that was never
applied is **left alone** — both `syncCookies` and the delete path check
`isApplied` first. See `docs/architecture/cookie-mocking.md`.

### The SDK server

`SdkServer.start()` spawns `test-site/server/sdk-server.ts` and waits for its
`/_sdk/health` route; `stop()` kills the process group and waits for it. It is
deliberately *not* in `webServer`: the extension connects to a hard-coded
`ws://localhost:8000` as soon as its service worker starts, so a server running
for the whole suite would join every other test — and "no SDK is running" is
itself a case worth testing.

Whether the *extension* has connected is a separate question from whether the
server is up, and neither side reports it. `waitForSdkConnection()` therefore
asks the only way it can: it requests `/sdk-probe` from the page and checks
whether the SDK answered. That path sits outside `/api` so the probes that fall
through before the socket is up are not counted by the test server.

### Three things that bite

**Activation needs two flags.** `OhMyContentState.isActive()` requires both
the domain's `aux.appActive` and the store's `popupActive` — "enabled for this
domain" and "popup open".
`ohMy.setActive()` sets both, which is what lets these tests run without the
popup.

**Mocks serve `responseMock`, not `response`.** `MockUtils.mockToResponse()`
reads `responseMock`/`headersMock`. Seeding only `response` yields an empty
mock. The driver writes both.

**Versions must match the manifest.** `MigrateUtils.shouldMigrate()` fires on
any stored object whose `version` differs from the extension's, and would
rewrite what was just seeded. The driver reads the version from
`chrome.runtime.getManifest()`.

## Before you believe a red run

On a loaded machine this suite drops two or three tests on timeouts — different
ones each run, which is the tell. Check `uptime` first: above roughly load 5 it
is unreliable, at idle it is a consistent 58/58 in two to three minutes.
Stray `test-site/server` processes from earlier runs are the usual cause:

    pkill -f "test-site/server"

**Two runs at once corrupt each other.** `reuseExistingServer` means a second
`playwright test` shares the first one's test site — and therefore its hit
counter, which the reset in the `server` fixture zeroes for everybody. That is
the same reason `workers: 1` exists, one level up. If a "the server was never
contacted" assertion fails with a count of 1 or 2 and passes on its own, check
for another suite running in a second terminal before suspecting the code.

**Every test failing at once is a different animal.** "No extension build found"
on all of them means `dist/` went away mid-run — `npm run build` deletes it
first, so a build started in another terminal takes the extension out from under
the suite. Run against a copy when something else may be building:

    cp -r dist /tmp/dist-pinned
    EXTENSION_PATH=/tmp/dist-pinned npx playwright test

## Single worker, deliberately

The "server was never contacted" assertion reads a counter on the one shared
test server. Parallel workers would reset and increment it concurrently and the
count would stop meaning anything. The whole suite runs in about a minute, so
the parallelism is not missed.

## Regression tests

Two tests exist because the behaviour they describe was once broken:
`fetch + text()` returned an empty body (`fetch/text.ts` assigned the looked-up
mock to `oHResult`, capital H, and discarded it), and `Response.ok` ignored a
mocked status code (a mocked fetch resolved with a bare `new Response()`, whose
internal status is 200, and only the `status` getter was overridden). Both are
fixed; the tests stay to keep them fixed.

## The two forks worth understanding

**Custom `jsCode` needs the popup** (`jscode.spec.ts`). While a mock's code is
the untouched default, the content script answers by itself. Edit it and the
answer can only come from the popup, because the `eval` runs in a sandboxed
iframe that lives there — extension pages may not `eval` at all.

With the popup closed, that request is not dropped: `sendMsg2Popup` waits its
full 5s timeout, the content script answers `ERROR`, the injected script reads
that as "not mocked" and sends the request to the real server. On its way out
the content script also clears `aux.appActive`, so the *next* request is not
stalled as well. The spec asserts all of it, including the stall.

**The SDK answers before storage is consulted** (`sdk.spec.ts`). Every
intercepted request goes to the background first; an `OK` from the SDK wins, and
anything else falls back to the stored mock. With no server, `dispatchRemote`
returns `NO_CONTENT` without touching the network, so the common case costs
nothing.

## Known gaps

- **The popup is only smoke-tested, except for cookies.** `popup.spec.ts`
  verifies it bootstraps, renders and reads storage; `jscode.spec.ts` drives its
  sandbox; `cookies.spec.ts` drives the Cookies tab end to end. Interacting with
  the request list, the response editor and the preset UI is still manual.
- **`consumeOwnWrite` is not isolated.** The recorder ignores the jar's own
  writes twice over — once by that set, and once by refusing to record a name it
  already has a mock for — and only the outcome is asserted, since every
  scenario an e2e test can reach hits the second guard as well. The one case
  that would separate them is a mock on a *deeper path* than a real cookie of
  the same name, and that path is currently broken: `applyCookie` looks the
  existing cookie up with `chrome.cookies.get`, which matches parent paths, so
  it records a cookie at `/` as displaced by a mock at `/admin` — and
  `unapplyCookie` then restores that instead of removing the cookie it wrote,
  leaving the mock applied for good. Worth covering once the jar compares paths.
- **Nothing asserts that the popup marks itself open.** Every spec sets
  `store.popupActive` through the driver, so none of them would notice if the
  popup stopped doing it. Worth writing once the popup does set it: at the time
  of writing `ContentService.activate()` patches `state.aux.popupActive`, a key
  `MigrateUtils` deletes and `isActive()` never reads, and `app.component.ts`
  only writes the real one when the domain *changes*. A test written against
  today's behaviour would encode that, so it is a gap on purpose.
