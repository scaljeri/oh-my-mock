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
| No ports in match patterns | Chrome rejects `*://localhost:8090/*` with "Invalid port". Registrations are keyed by **host**, so mocking `localhost:4200` puts the bundle on `localhost:8080` too. Those pages are told `active: false` by their own content script and hand the page's `fetch`/`XHR` back (`src/injected/restore-originals.ts`). |

The last one is the only reason a verdict still travels to the page at all. The
bundle assumes it is wanted — being there is what says so — and the content
script only ever corrects it downwards.

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
4. **Two ports of one host cannot be told apart** by a registration. See the
   table above.
