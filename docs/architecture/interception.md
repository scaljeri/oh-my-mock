# Why interception works by patching `fetch`

OhMyMock intercepts requests by injecting a script into the page and replacing
`window.fetch` and `XMLHttpRequest`. That is an unusual thing for a Chrome
extension to do, and the obvious question is whether an extension API could do
it instead. This page records the answer so it does not have to be rediscovered.

## The short version

**No MV3 API can replace it.** For a mocking tool, patching is the right
mechanism, and the only real alternative carries a cost that is almost certainly
unacceptable.

## What the platform offers

| API | Can | Cannot |
|---|---|---|
| `declarativeNetRequest` | block, redirect, modify headers | **supply a response body** — rules are declarative, not computed per request in JS; no access to the request body |
| `webRequest` | observe, in MV3 | block or answer; `webRequestBlocking` is MV2-only, or policy-installed extensions |
| `chrome.debugger` | **everything** — `Fetch.requestPaused` + `Fetch.fulfillRequest` returns a fully synthetic response | see below |

`declarativeNetRequest` can redirect to a file packaged with the extension, but
that serves a *static* file. "Answer this endpoint with a body that depends on
what was sent" is outside what it can express.

`chrome.debugger` genuinely can do all of it, at network level: every request,
including ones from workers, iframes, images and navigations. No injection, no
CSP problem, no start-up race. The costs:

- Chrome shows a permanent **"OhMyMock is debugging this browser"** banner
- DevTools cannot be attached to the same tab at the same time
- it needs the `debugger` permission, which the Web Store reviews closely

For a tool that sits open all day during frontend work, the banner alone rules
it out.

> Checked against MV3 as of mid-2026. These APIs move; re-verify against current
> documentation before making a decision on this.

## What patching costs us

Choosing this mechanism has consequences that show up all over the codebase:

**Getting into the page's world at all.** A content script runs in an isolated
world, where patching `window.fetch` changes nothing the page can see. The
bundle is therefore registered as a `world: 'MAIN'` content script, per active
domain, through `chrome.scripting.registerContentScripts` — see
[below](#how-the-bundle-gets-onto-the-page).

**CSP.** A strict `script-src` blocked the `<div onclick>` trick this used to
depend on. A MAIN-world content script is not blocked by it (measured on
Chromium 151), so `content/page-context.ts` now only escalates when the bundle
fails to report in for some *other* reason: it asks the background to strip the
site's `Content-Security-Policy` header via `declarativeNetRequest` and reloads
the page. That weakens the security of the site under test, which is a trade
worth being explicit about — and one that should now essentially never be made.

**Blind spots.** Anything that does not go through the page's main-world
`fetch`/`XHR` is invisible:

- web workers and service workers (separate JS worlds)
- iframes — the manifest does not currently set `all_frames`
- `<img>`, `<script>`, `<link>`, navigations, `EventSource`, `WebSocket`

**Faking `fetch` faithfully is fiddly.** A mocked call has to resolve with a real
`Response` object, so the body cannot be handed over at that moment; it is
delivered when the page calls `.json()`/`.text()`/`.blob()`, each of which is a
separate patch on `Response.prototype`. See
[request-flow.md](./request-flow.md#8-injected-the-cache-and-why-it-exists).
Getting this wrong is easy: a mocked `Response` used to report `ok: true` for a
mocked 500, because only the `status` getter was overridden while `ok` read the
untouched internal slot.

## How the bundle gets onto the page

`src/background/main-world.ts` registers `oh-my-mock.js` as a content script
with `world: 'MAIN'` and `runAt: 'document_start'`, one registration per active
domain, and unregisters it when the domain is switched off or deleted. So the
script's *presence* is the answer to "is this domain mocked": it is evaluated
before any script the page has of its own, and on a domain nobody mocks it is
not there at all.

That replaced a two-script arrangement whose whole cost was the gap between
them. The content script spliced a shim (`src/early-inject`) into itself as a
string at build time and clicked it into the page through a `<div onclick>`;
the shim parked over `fetch`/`XHR` and **held** every call, polling at 50ms,
until the real bundle arrived over a `<script src>` — with a ten-second backstop
and a "release" message for the case where it never would. All of it went on
every page in the browser, because being in place before the answer was known
was the only way to catch a request made from an inline script in `<head>`.

Three things about the API shape the design, each measured on Chromium 151
rather than assumed:

| | |
|---|---|
| Registrations do not survive | `persistAcrossSessions` reads back `true`, and a registration made in one browser session was still gone in the next — same profile, same extension id. The store is the only authority, and every service-worker start reconciles from it. |
| Only future navigations | A page already open never sees a new registration until it reloads, so switching a domain on also `executeScript`s into the tabs open on it. |
| Ports need a named scheme | Chrome rejects `*://localhost:8090/*` with "Invalid port", which reads like "match patterns have no ports" and is not what the rule says. Chromium validates a port against the scheme's default (`IsValidPortForScheme`, `extensions/common/url_pattern.cc`): a port is accepted only for a scheme that *has* one, and the wildcard `*` has none. Registering `http://localhost:8090/*` and `https://localhost:8090/*` instead carries the port through — and `*` expands to exactly those two schemes, so it is not a widening. Registrations are keyed by **domain**, port and all. |

Registrations were keyed by host until that was checked, so mocking
`localhost:8090` put the bundle on `localhost:8091` too and that page had to be
talked back down. Two ports of one host are two registrations now, and the
second page gets nothing at all.

A verdict still travels to the page, for the cases a registration cannot
anticipate — a domain switched off while its page is open, and a registration
that outlived the domain it was made for. The bundle assumes it is wanted —
being there is what says so — and the content script only ever corrects it
downwards, handing `fetch`/`XHR` back via `src/injected/restore-originals.ts`.

## What Chrome version this actually needs

`minimum_chrome_version` is **109**. Every floor below was read off a primary
source, named beside it. None of them is from recollection — the previous value
of `111` was, and it was wrong.

| What the extension uses | Floor | Source read |
|---|---|---|
| MV3 itself: `manifest_version: 3`, `background.service_worker`, `action`, `host_permissions`, `chrome.scripting` | 88 | `chrome.scripting` reference — availability line reads "Chrome 88+ MV3+" |
| `web_accessible_resources` object form with `matches` | 88 | MDN browser-compat-data, `webextensions/manifest/web_accessible_resources.json`: `matches`, `resources` and `extension_ids` are each `"version_added": "88"` |
| `chrome.scripting.executeScript` with `world: 'MAIN'` (`main-world.ts`, for tabs already open) | 95 | `chrome.scripting` reference — `ExecutionWorld` carries the badge "Chrome 95+". "What's new in Chrome extensions", Chrome 95: "The `chrome.scripting` API's `executeScript()` method can now inject scripts directly into a page's main world." MDN BCD `webextensions/api/scripting.json` agrees: `executeScript` `world` `MAIN` is `"version_added": "95"` |
| `chrome.scripting.registerContentScripts` / `unregisterContentScripts` / `getRegisteredContentScripts` | 96 | `chrome.scripting` reference — badge "Chrome 96+" on `registerContentScripts` and on `ContentScriptFilter`. MDN BCD agrees: `"version_added": "96"` |
| `world` on `RegisteredContentScript` — the MAIN-world registration the whole design rests on | 102 | `chrome.scripting` reference — badge "Chrome 102+" on `RegisteredContentScript.world`. "What's new", Chrome 102: "Dynamically registered content scripts can now specify the world that assets will be injected into." MDN BCD agrees: `RegisteredContentScript` `world` is `"version_added": "102"`, as is `ExecutionWorld` |
| `chrome.storage.session` (`cookie-jar.ts`, `forgotten-domains.ts`, `lift-out-requests.ts`) | 102 | MDN browser-compat-data, `webextensions/api/storage.json`: `session` is `"version_added": "102"` |
| **`chrome.offscreen`** + `Reason.IFRAME_SCRIPTING` (`sandbox-host.ts`) | **109** | `chrome.offscreen` reference — availability line reads "Chrome 109+ MV3+". "What's new", Chrome 109: "Offscreen documents are now available in Manifest V3 extensions." |
| `cookies`, `tabs`, `windows`, `unlimitedStorage`, `storage.local`, the `sandbox` manifest key | well below 88 | MDN BCD `webextensions/manifest/sandbox.json` puts `sandbox` at Chrome 21; the rest predate MV3 entirely |

The highest is `chrome.offscreen` at 109, so the minimum is 109. `offscreen`
being the binding constraint is easy to miss — it is two years later than MV3
itself, and it arrived here only because the custom-mock sandbox moved off the
popup page. `Reason.IFRAME_SCRIPTING` does not raise it: no value in the
`Reason` enum carries a badge of its own, and it was in the enum at the 109
launch.

The four pages, so the next person re-reads rather than re-derives:

- `https://developer.chrome.com/docs/extensions/reference/api/scripting`
- `https://developer.chrome.com/docs/extensions/reference/api/offscreen`
- `https://developer.chrome.com/docs/extensions/whats-new`
- `https://github.com/mdn/browser-compat-data` → `webextensions/manifest/*.json`,
  `webextensions/api/storage.json`

One trap in that list: Chrome's **manifest** reference pages carry no version
badges at all. Only the **API** reference pages do. Anything manifest-shaped has
to be looked up in browser-compat-data.

### Why 111 was wrong

111 is a real number, but for a key this manifest does not use. `world` on a
**static** `content_scripts` entry in `manifest.json` is Chrome 111 — MDN
browser-compat-data, `webextensions/manifest/content_scripts.json`, where the
`world` subfeature is `"version_added": "111"`. (Chrome's own manifest reference
for `content_scripts` carries no version badge at all, which is how the number
went unverified for so long.)

This extension never declares `world` in the manifest. Its `content_scripts`
entry is the plain isolated-world `content.js`; the MAIN-world injection is
*dynamic*, through `registerContentScripts`, whose `world` floor is 102. So 111
locked out Chrome 109 and 110 for a feature nothing here asks for.

### The one place the docs are demonstrably wrong: `offscreen.hasDocument`

`sandbox-host.ts` calls `chrome.offscreen.hasDocument()`, and the current
`chrome.offscreen` reference badges that method **"Chrome 150+"** — five weeks
old at the time of writing. Taken at face value that would make the floor 150.
It is not: `hasDocument` was **measured present and working on Chromium 149**
(`typeof chrome.offscreen.hasDocument === 'function'`, and the call returns
`false` rather than throwing), loaded as a real MV3 extension. So the badge
cannot be an availability floor.

The history explains it. `hasDocument` was added in Chromium commit
`ff559c99` (8 July 2022, "[Extensions Offscreen Documents] Add closeDocument()
and hasDocument()") already annotated `[supportsPromises, nodoc]`, with the
comment "This probably isn't something we want to ship in its current form
(hence the nodoc)". `nodoc` suppresses *documentation generation only* — it
never removed the method from the runtime. The 150 badge is when the annotation
came off and the docs caught up, not when the method appeared; Chrome 150's
"What's new" entries do not mention it.

Two things pull the other way and are recorded here rather than smoothed over:

- Oliver Dunk (Chrome DevRel) wrote on 6 February 2023, in the
  chromium-extensions thread "Lifecycle of offscreen documents", that
  "hasDocument has been removed (it was only ever available while the API was
  experimental)". The Chromium 149 measurement contradicts that, and no removal
  commit could be found, but the statement exists.
- This machine is aarch64 and Chrome-for-Testing publishes no arm64 builds, so
  **109 through 148 could not be exercised directly**. The two Chromiums on hand
  were 149 and 151, which happen to straddle the badge exactly.

So the residual risk is narrow and named: if `hasDocument` really was absent for
some stretch below 149, custom-mock evaluation (and only that) would throw on
those versions. The clean way to retire the risk is to stop depending on an
undocumented method — `chrome.runtime.getContexts()` has been documented since
Chrome 116 and answers the same question — which would leave every floor in the
table above backed by a badge. Until then 109 stands, because it is what the
documented APIs require and what measurement supports.

## The problems that are *not* caused by this choice

Worth separating, because they are fixable without changing the mechanism:

1. ~~**Mocking only works while the popup is open.**~~ **Fixed.**
   `content-state.ts` required `store.popupActive` as well as `aux.appActive`,
   because custom mock code was evaluated in a sandboxed iframe living on the
   popup page. That sandbox is hosted by the background in an offscreen document
   now (`src/background/sandbox-host.ts`), so the gate is gone: a domain that is
   switched on mocks, popup or no popup.
2. **Iframes are not covered.** One `all_frames: true` in the manifest, and the
   same on the registration in `main-world.ts`.
3. **CSP stripping is a blunt instrument.** Very likely dead now: a MAIN-world
   content script runs behind `script-src 'self'`, which is what the stripping
   existed to get past. It is still wired up, and no test exercises it any more.
4. ~~**Two ports of one host cannot be told apart** by a registration.~~
   **Fixed.** It was never an API limitation, only a misread of one: Chrome
   refuses a port under the *wildcard* scheme, not a port as such. Naming the
   two schemes `*` stands for — `http://localhost:8090/*` and
   `https://localhost:8090/*` — registers with the port intact, so mocking
   `localhost:8090` no longer puts the bundle on `localhost:8091`. See the
   table above, `matchPatterns` in `src/background/main-world.ts`, and the
   spec `another port of a mocked host is left entirely alone` in
   `tests/specs/onload.spec.ts`.
