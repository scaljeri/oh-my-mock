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

**The start-up race.** The page can call `fetch` before the injected bundle has
loaded. `src/early-inject/index.ts` is a synchronously-injected shim that
installs a placeholder and polls until the real patch lands. It is inlined into
`content.js` as a string, which is why it may not contain template literals.

**CSP.** A strict `script-src` blocks the injected script. `content/inject-code.ts`
waits 500ms for the injection to report in and, if it does not, asks the
background to strip the site's `Content-Security-Policy` header via
`declarativeNetRequest` and reloads the page. It works, and it weakens the
security of the site under test — a trade worth being explicit about.

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

## The problems that are *not* caused by this choice

Worth separating, because they are fixable without changing the mechanism:

1. ~~**Mocking only works while the popup is open.**~~ **Fixed.**
   `content-state.ts` required `store.popupActive` as well as `aux.appActive`,
   because custom mock code was evaluated in a sandboxed iframe living on the
   popup page. That sandbox is hosted by the background in an offscreen document
   now (`src/background/sandbox-host.ts`), so the gate is gone: a domain that is
   switched on mocks, popup or no popup.
2. **Iframes are not covered.** One `all_frames: true` in the manifest.
3. **CSP stripping is a blunt instrument.** Worth revisiting whether the
   injection can be made to work without removing the header.
