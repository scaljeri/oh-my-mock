# Plan: request tracing

**Goal.** One log that shows every phase an intercepted request goes through,
across all five contexts, and — separately — every request the *browser* made.
Crossing the two answers the three questions that actually get asked: was this
request mocked, was it intercepted and then let through, or did OhMyMock never
see it at all.

The destination is a **chat message**: a Log tab with a record button and copy
to clipboard, so a trace can be pasted straight into a conversation. That is not
a detail of the UI — it decides the format (readable text, not JSON), the volume
(a reproduction, not a day) and what the detail may carry.

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

### The four quadrants

The two layers are only useful *crossed*. The load-bearing fact is that **a
mocked request never reaches the network**: `ohMyFetch` resolves a synthetic
`Response` without calling the original `fetch`. So absence from `webRequest` is
not missing information — it is the evidence that mocking worked.

| Trace? | webRequest? | Meaning |
| --- | --- | --- |
| yes | **no** | **Mocked.** Served by the extension, the network was never touched |
| yes | yes | **Passed through.** Intercepted, then deliberately not mocked |
| no | yes | **Missed.** The extension never saw this request |
| no | no | Nothing happened |

Row two matters as much as row three, and is easy to overlook. "I created a mock
and the request still hits my server" is the most common complaint there is, and
this separates its two causes at a glance: a trace beside the network call means
the request *was* intercepted and the mock did not match — wrong url pattern,
wrong method, wrong preset, or switched off. Without the crossing, that case
would look identical to a miss and send the reader hunting in the wrong layer.

Row one is worth logging for the same reason the e2e suite asserts on the test
server's hit count: it is the only positive proof the request was kept off the
network.

### Why a miss was missed

For row three, `chrome.webRequest` reports `tabId`, `frameId`, `type` and
`initiator` — enough to name the cause rather than just the symptom:

| Observation | Meaning |
| --- | --- |
| `type: xmlhttprequest`, `frameId: 0` | **A real miss** — this should have been caught |
| `frameId > 0` | An iframe; known gap, the manifest does not set `all_frames` |
| `tabId: -1` | A worker or service worker — a different JS world |
| Earlier than the page's first trace | Lost the race with the early-inject shim |
| `type: image` / `script` / `stylesheet` | Not an API call; correctly ignored |

Only the first row is a bug. The rest are the documented limits of the
interception design, and seeing them labelled is the product.

One caveat for the reader of a log: when the NodeJS SDK answers, the content
script serves that response and the origin is never contacted — so it reads as
"mocked" — but the SDK websocket to `localhost:8000` does appear in `webRequest`
as a `websocket` entry. Filtering the shadow to `xmlhttprequest` keeps that out
of the crossing.

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

**Written in batches, not per event.** One IndexedDB transaction per event would
sit on the path of every request. Buffer in memory and flush every ~100 events
or every second, plus a flush on `runtime.onSuspend` so the tail is not lost
when the worker is torn down.

### How much is "a lot"

A redacted event is about 200 bytes, and the phases above come to roughly ten
events per request — call it 2 KB per API call.

| Situation | Events | Size |
| --- | --- | --- |
| One heavy page load (500 calls) | 5,000 | ~1 MB |
| An hour of use (5,000 calls) | 50,000 | ~10 MB |

That is comfortable, and `unlimitedStorage` is already in the manifest.

**Bodies are what makes it big, not events.** One 50 KB JSON response weighs as
much as 250 events, so switching them on takes a request from 2 KB to hundreds.
That is the reason the body toggle hides by default; cookie values cost a few
dozen bytes and hide by default for consistency rather than for size.

### Two modes

The real lever is duration, not storage. You do not trace all day.

**Flight recorder** — always on, capped at ~5,000 events, oldest out first. Cheap,
and it means "wait, that just went wrong" still has a history behind it.

**Recording** — started deliberately: reproduce, stop, export. Bounded by the
reproduction rather than by a ring buffer, so it is the mode that may include
bodies. This is also the one that produces a file small enough to hand to
someone: seconds to a minute of traffic, a few thousand events, well under a
megabyte.

Both are bounded by count *and* bytes. An unbounded buffer on disk is a bug of
its own.

## What goes in the detail

Two independent toggles, **both hiding by default**. The log is about what
happened, not what was in it; content is there for the case where the value is
the question.

| Toggle | Default | What it reveals |
| --- | --- | --- |
| **Hide cookie values** | on | The actual value per cookie. Turn it off when the question is "is my mocked value in the jar, or still the site's own?" |
| **Hide body values** | on | Request and response bodies. This is the volume lever — one 50 KB response weighs as much as 250 events |

Always present regardless: url, method, status, content type, body *size*, and
for cookies the name, path and flags. Those answer most questions on their own —
a cookie that is present with the right flags but the wrong value is a different
bug from one that is not there at all, and the first is visible without showing
anything.

`authorization` and other credential headers stay out entirely. They are never
the answer to "why did my mock not fire", so there is nothing to trade.

**The copied header records the state of both toggles:**

```
ext 3.3.15 · Chrome 141 · recorded 12.4s · cookie values: hidden · bodies: hidden
```

Not a warning — a legend. Without it, a reader cannot tell "hidden by a toggle"
from "there was nothing there", and those lead to different conclusions.

## The Log tab

A third tab beside Requests and Cookies, scoped to the selected domain like the
other two.

- A **record** button. Stopped, the flight recorder is still running underneath,
  so there is always some history; started, it keeps everything for this domain
  and may include bodies.
- The traces for this domain, newest first, one block per request, each labelled
  from the four quadrants: **mocked**, **passed through**, **missed**.
- **Copy to clipboard.**

### The copied format is text, not JSON

The destination is a chat message, so it has to be read by a human and a model,
not parsed. JSON of the same content is several times longer and far worse to
skim. One block per request, phases in order, elapsed ms in the left column:

```
OhMyMock trace — localhost:8090
ext 3.3.15 · Chrome 141 · recorded 12.4s · cookie values: hidden · bodies: hidden
7 requests: 3 mocked · 3 passed through · 1 missed

▸ GET /api/users                                   MOCKED   4ms
   0.0  injected  fetch.patched
   0.2  injected  dispatch.sent          trace=k3f9d2
   0.9  content   request.received
   1.1  content   sdk.asked              no server connected
   1.3  content   mock.lookup            hit  request=a1b2 mock=c3d4 preset=default
   1.4  content   fork.fast              jsCode untouched
   2.0  injected  response.synthetic     200 application/json 96B
   3.8  injected  body.read              json
   4.1  background cookie.sync           set ohMySession (httpOnly, /) — value hidden

▸ GET /api/orders?page=2                      PASSED THROUGH  31ms
   0.0  injected  fetch.patched
   1.2  content   mock.lookup            no match
                                         stored: ^/api/orders$ (GET), ^/api/users$ (GET)
  30.4  network   webrequest.seen        200 — reached the server

▸ POST /api/track                                  MISSED
        network   webrequest.seen        frameId=2 → iframe, all_frames is off
```

A missed request has no trace at all, so it is printed from the shadow alone —
which is the point: the absence *is* the finding.

### The line that earns its place

`mock.lookup  no match` with the patterns it compared against. "I made a mock
and it still hits my server" is the most common complaint there is, and the
answer is nearly always visible in that one line: an anchored url pattern that
does not match, a method that differs, a preset that is not the active one, or a
request that is switched off. Printing the comparison beats printing the verdict.

### Copy scoping

A recording of twenty requests is about 160 lines — fine to paste. Five hundred
requests is not. So the button offers:

- **Copy problems** (default) — the header, the counts, and only the passed-through
  and missed blocks. Mocked requests are the ones that worked.
- **Copy all**
- **Copy this request** — per block, for when the question is about one call.

A JSON export of the raw events stays available for anything a script wants to
read, but it is the secondary path, not the primary one.

## Build order

1. `trace()` beside the existing builders in `logging.ts`, off by default, with
   the switch in the store. No call sites yet.
2. The background collector: IndexedDB, batched writes, both modes.
3. Phases in **injected** and **content** first — that is the path the question
   is usually about, and it is enough to render a useful block.
4. The Log tab: record button, the per-request blocks, and copy to clipboard.
   The formatter is pure and unit tested — given events, produce that text —
   so it is verifiable without a browser.
5. Background and popup/sandbox phases.
6. `chrome.webRequest` shadow plus the quadrant classification. The manifest
   permission lands here, not earlier.

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

## Settled

**What the log carries**: names, paths, flags, sizes and status always; cookie
values and bodies only when their toggle is turned off — both hide by default.
Credential headers never. See "What goes in the detail".
