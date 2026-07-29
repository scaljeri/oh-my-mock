# Plan: request tracing

**Goal.** One log that shows every phase an intercepted request goes through,
across all five contexts, and — separately — every request the *browser* made,
so a call OhMyMock never saw is visible as a gap rather than as silence. The log
must be exportable as a single file that can be handed to someone else for
debugging.

Scope for the first version: **the API request path only**. Not popup actions,
not storage writes. That is what the request-flow document already describes, it
is where the confusing behaviour lives, and it keeps the volume down.

## What already exists — do not rebuild it

**The correlation id.** `src/injected/message/dispatch-api-request.ts` mints a
`uniqueId()` per intercepted request and puts it in `context.id`. That id
already travels through every hop: injected → content → background → popup →
sandbox and back. It is the trace id. Without it this would be a much larger
job.

**A single logging funnel.** `src/shared/utils/logging.ts` builds the
`debug`/`log`/`warn`/`error` used by each context, and `no-console` is an ESLint
error everywhere else. There is exactly one place to hook into.

**A dead debug flag.** `scripts/token-replace.js` still replaces
`__OH_MY_SHOW_DEBUG__` in `oh-my-mock.js` and `content.js`, but no source file
contains that token any more — the replacement is a no-op. Either reuse the
token for the trace switch or delete it; leaving a build step that does nothing
is how the next person loses an hour.

## Two layers, and why both are needed

**Layer A — what OhMyMock intercepted.** The patched `fetch`/`XHR` in the page's
main world, reporting each phase it passes through.

**Layer B — what the browser actually did.** `chrome.webRequest`, observational.
Still allowed in MV3; only the *blocking* flavour was removed.

Layer B has to be independent, which is exactly why `PerformanceObserver` is not
enough: it runs in the same world as layer A and shares its blind spots (worker
requests, cross-origin iframes). It cannot be evidence that nothing was missed.

`host_permissions` is already `<all_urls>`, so this costs one manifest entry:
`webRequest`. The extension is not published, so there is no installed base to
push through a re-accept.

### Classifying a gap

The point is not "we missed one" but *why*. `chrome.webRequest` reports
`tabId`, `frameId`, `type` and `initiator`, which is enough to say:

| Observation | Meaning |
| --- | --- |
| `type: xmlhttprequest`, `frameId: 0`, no trace | **A real miss** — this should have been caught |
| `frameId > 0` | An iframe; known gap, the manifest does not set `all_frames` |
| `tabId: -1` | A worker or service worker — a different JS world |
| Earlier than the page's first trace | Lost the race with the early-inject shim |
| `type: image` / `script` / `stylesheet` | Not an API call; correctly ignored |

Only the first row is a bug. The rest are the documented limits of the
interception design, and seeing them labelled is the product.

## The event model

One flat record per event:

```ts
interface IOhMyTraceEvent {
  /** epoch ms */
  t: number;
  /** `context.id` — the id that already travels with the packet */
  trace: string;
  ctx: 'injected' | 'content' | 'background' | 'popup' | 'sandbox';
  /** e.g. `fetch.patched`, `mock.lookup`, `fork.sandbox` */
  phase: string;
  /** ms since the previous event of this trace; filled in on collection */
  ms?: number;
  detail?: Record<string, unknown>;
}
```

Phases follow `docs/architecture/request-flow.md`, so that document is the
legend:

| Context | Phases |
| --- | --- |
| injected | `fetch.patched`, `dispatch.sent`, `response.synthetic`, `body.read` |
| content | `request.received`, `sdk.asked`, `mock.lookup`, `fork.fast` / `fork.sandbox`, `response.sent` |
| background | `sdk.dispatch`, `handler.<type>`, `webrequest.seen` |
| popup | `sandbox.dispatch`, `jscode.result` |

## Where it is collected and stored

Everything funnels to the **background service worker** — the only context every
other one can reach. The injected script has no `chrome.*` at all, so its events
ride the existing `postMessage` hop to the content script rather than getting a
new transport.

Storage there is **IndexedDB**, for two reasons:

1. **An MV3 worker is torn down after roughly 30 seconds idle**, so an in-memory
   buffer is lost exactly when a slow bug is being reproduced.
2. **`chrome.storage` would feed back into the UI.** `StorageUtils.callback`
   listens on `chrome.storage.onChanged` *without filtering by area* and pushes
   every change into `updates$`, which the popup subscribes to. A log line would
   re-render the app, which would log, which would re-render. If we ever do want
   a `chrome.storage` area for this, that listener has to learn to filter first.

Bounded by both count and bytes — a busy page produces thousands of events, and
an unbounded ring buffer on disk is a bug of its own. Oldest out first.

## Redaction

**This log is meant to be sent to someone else.** Request bodies, `authorization`
headers and cookies are in the exact stream being traced.

Recommendation: redacted by default — url, method, status, content type, body
*size*; no body content, no cookie values, no `authorization`. A deliberate
"include bodies" switch for the case that cannot be found otherwise, and the
export names loudly what it contains.

**This is the one decision still open** (see below).

## Export

A button in the popup writes one JSON file: the events, the webRequest shadow,
the gap classification, and a header with the extension version, the Chrome
version, the manifest permissions and the active domain — so the reader has the
context without having to ask for it.

## Build order

1. `trace()` beside the existing builders in `logging.ts`, off by default, with
   the switch in the store. No call sites yet.
2. The background collector: IndexedDB, ring buffer, and the export.
3. Phases in **injected** and **content** first — that is the path the question
   is usually about.
4. Background and popup/sandbox phases.
5. `chrome.webRequest` shadow plus the gap classification. Manifest permission
   lands here, not earlier.

Each step is its own commit, verifiable on its own.

## Constraints to respect

- **Off by default.** Tracing every request on every page costs real time, and a
  `webRequest` listener fires for the whole browser, not just the test page.
  Scope it to the active tab and the domains OhMyMock is switched on for.
- **`src/early-inject/index.ts` may contain no template literals.** Its output is
  spliced into `content.js` inside one. If the earliest phases are traced from
  there, string concatenation only.
- **The correlation is joined at export, not while logging.** `webRequest` has
  its own `requestId`; matching it to a trace on url + method + time window is
  the expensive part and belongs in the export path, so the write path stays
  cheap.
- **No `console.*` outside `logging.ts`** — `no-console` is an error, and the
  trace must go through the same funnel rather than around it.

## Open decision

**Redaction default.** Bodies out of the log unless explicitly switched on
(recommended), or everything in and cleaned up by hand before sending? This
changes what `detail` may carry, so it is worth settling before step 1.
