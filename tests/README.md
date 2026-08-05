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

`npm run build:bundles` is a faster alternative that compiles only the six
webpack bundles (content, injected, early-inject, sandbox, offscreen,
background) plus the manifest and icons — about ten seconds instead of a
minute. It is enough for everything that only intercepts; the many specs that
open the popup — `popup.spec.ts`, `cookies.spec.ts`, `sidebar-groups.spec.ts`
and the rest of the UI-driving files, currently twenty of the thirty-two —
need the Angular build.

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

### …except where the popup is the thing under test

Seeding skips the steps that *create* a mock, so a mock arrives already
recorded, already selected and already enabled. A number of specs therefore do
it the long way round, by clicking. The two that bracket the range:

- `record-and-mock.spec.ts` — the whole journey with nothing seeded at all:
  switch the domain on in the popup, let the site make a real call, watch it
  appear in the request list, serve it, then edit what it serves.
- `edit-response.spec.ts` — a seeded mock, re-edited through the detail pane.

Reach for these only for behaviour that lives in the popup. Everything about
interception itself is cheaper and steadier to seed.

Two things that bite when driving the popup:

- **Opening the popup on a domain that is off** puts `oh-my-disabled-enabled`
  over the page, and it swallows clicks until its toggle is answered.
- **The request list draws its url as CSS `content`**, split into two halves for
  a middle ellipsis, so `hasText: '/api/json'` never matches — the rendered text
  is `/api /json`. Match on `[x-test="row-endpoint"][title="…"]` instead.

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

Nothing on the mocking path needs the popup any more — the sandbox that once
lived there belongs to the background now — so it is opened only when the popup
itself is under test. Playwright cannot press the toolbar button, which is
where the popup normally learns which tab it is inspecting, so `openPopup()`
passes `domain` and `tabId` on the query string instead.
`src/app/app.initialize.ts` reads them from there, exactly as the toolbar does.

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
deliberately *not* in `webServer`: the background dials the SDK only when the
store says `remote.target === 'server'` (`connectIfEnabled` in
`src/background/dispatch-remote.ts`), which a spec opts into with
`ohMy.setRemote('server')` — and "no SDK is running" is itself a case
`sdk.spec.ts` tests, which it can only do while nothing is listening.

Whether the *extension* has connected is a separate question from whether the
server is up, and neither side reports it. `waitForSdkConnection()` therefore
asks the only way it can: it requests `/sdk-probe` from the page and checks
whether the SDK answered. That path sits outside `/api` so the probes that fall
through before the socket is up are not counted by the test server.

### Three things that bite

**Activation is one flag.** `OhMyContentState.isActive()` reads the domain's
`aux.appActive` and nothing else. It used to require the store's `popupActive`
as well — the popup hosted the eval sandbox then, so mocking died with the
popup. `ohMy.setActive()` still writes both, because "a popup was open here" is
the state it fakes; `ohMy.setPopupActive(false)` exists to take that trace away
again, which is how `jscode.spec.ts` proves the second flag no longer matters.

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
is unreliable, at idle it is a consistent 131/131 in a handful of minutes.
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
count would stop meaning anything. The whole suite runs in a few minutes, so
the parallelism is not missed.

## Regression tests

Two tests exist because the behaviour they describe was once broken:
`fetch + text()` returned an empty body (`fetch/text.ts` assigned the looked-up
mock to `oHResult`, capital H, and discarded it), and `Response.ok` ignored a
mocked status code (a mocked fetch resolved with a bare `new Response()`, whose
internal status is 200, and only the `status` getter was overridden). Both are
fixed; the tests stay to keep them fixed.

## The two forks worth understanding

**Custom `jsCode` goes to the background** (`jscode.spec.ts`). While a mock's
code is the untouched default, the content script answers by itself. Edit one
character of it and the code has to be *run*, which only a sandboxed page may do
— extension pages may not `eval` at all — so the content script dispatches
`EVAL` to the background, which holds the sandboxed iframe in an offscreen
document and is always there to answer.

That sandbox used to live on the popup page, so an edited mock silently stopped
working whenever the popup was closed: the request stalled the full 5s
`sendMsg2Popup` timeout, went through unmocked, and `aux.appActive` was cleared
on the way out so the next request would not stall too. `jscode.spec.ts` runs
every test without a popup and asserts the stall and the switch-off are gone —
putting the sandbox back would fail there loudly.

**The SDK is a source, not a layer** (`sdk.spec.ts`). Stored mocks are the
default; the background is only asked at all when the store says
`remote.target === 'server'`, and then it is asked *exclusively* — this
browser's own mocks are not consulted, and a request the SDK has no answer for
goes to the real server rather than falling back. With the default target,
nothing is sent to the background per request, so the common case costs
nothing.

## Known gaps

- **Two popup pages are still manual.** The rest of the popup is driven for
  real now — the request list (`request-list.spec.ts`), the response editor
  (`create-response.spec.ts`, `edit-response.spec.ts`, `detail-panel.spec.ts`),
  presets (`preset-delete.spec.ts`), the HAR import (`har-import.spec.ts`), the
  Domains page (`domains-page.spec.ts`), the Cookies tab (`cookies.spec.ts`),
  the group drawer (`sidebar-groups.spec.ts`) and the Remote mocking page
  (`remote-mocking.spec.ts`). What nothing drives yet is the JSON export and
  the state explorer.
- **`consumeOwnWrite` is not isolated.** The recorder ignores the jar's own
  writes twice over — once by that set, and once by refusing to record a name it
  already has a mock for — and only the outcome is asserted, since every
  scenario an e2e test can reach hits the second guard as well. The one case
  that would separate them is a mock on a *deeper path* than a real cookie of
  the same name. That used to be unreachable because `applyCookie` recorded the
  parent-path cookie as displaced; the jar compares paths now (see the
  `/api/admin` fixture in the test site), so the isolating test is writable —
  it just has not been written.
