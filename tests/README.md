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
```

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
| `ohMy` | seed mocks, activate domains, read state (`tests/fixtures/oh-my-mock.ts`) |
| `site` | the page, plus `request()` and `waitForInjection()` |
| `server` | the test server's hit counter |
| `serviceWorker`, `extensionId`, `context` | the raw Playwright handles |

### Three things that bite

**Activation needs two flags.** `OhMyContentState.isActive()` requires both
`aux.appActive` and `aux.popupActive` — normally "enabled" and "popup open".
`ohMy.setActive()` sets both, which is what lets these tests run without the
popup.

**Mocks serve `responseMock`, not `response`.** `MockUtils.mockToResponse()`
reads `responseMock`/`headersMock`. Seeding only `response` yields an empty
mock. The driver writes both.

**Versions must match the manifest.** `MigrateUtils.shouldMigrate()` fires on
any stored object whose `version` differs from the extension's, and would
rewrite what was just seeded. The driver reads the version from
`chrome.runtime.getManifest()`.

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

## Known gaps

- **Custom mock `jsCode` is not covered.** Mocks whose code has been edited are
  evaluated in the popup's sandbox iframe rather than served directly by the
  content script (`src/content/handle-api-request.ts:61` takes the direct path
  only while `jsCode` is untouched). `popup.spec.ts` checks the sandbox frame
  exists; nothing drives an evaluation through it yet.
- **The NodeJS SDK path is not covered.** `npm run test-site:sdk` starts the
  server; no spec drives it yet.
- **The popup is only smoke-tested.** `popup.spec.ts` verifies it bootstraps,
  renders and reads storage. Interacting with the request list, the response
  editor and the preset UI is still manual.
