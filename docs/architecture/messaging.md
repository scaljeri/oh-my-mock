# Messaging between the parts

Four contexts need to talk to each other and none of them share memory. This
page describes the transports, the envelope, and the two habits that make the
traffic readable once you know them.

## Three transports, one bus

| From → to | Transport | Wired up by |
|---|---|---|
| injected ↔ content | `window.postMessage` | `shared/utils/trigger-msg-window.ts` |
| content → background/popup | `chrome.runtime.sendMessage` | `shared/utils/send-to-background.ts` |
| popup → content | `chrome.tabs.sendMessage` | `shared/utils/send-to-content.ts` |

`OhMyMessageBus` (`shared/utils/message-bus.ts`) hides which one is in play. A
context registers the transports it has and then filters a single stream:

```ts
const bus = new OhMyMessageBus()
  .setTrigger(triggerWindow)     // page world
  .setTrigger(triggerRuntime);   // extension

bus.streamByType$(payloadType.RESPONSE, appSources.CONTENT).subscribe(...);
```

Three filters are available: `streamByType$`, `streamBySource$` and
`streamById$` — the last one is how a reply is matched to its request.

## It is a broadcast, not a relay

This trips people up. `chrome.runtime.sendMessage` from the content script
reaches **every** extension context that is listening — the background service
worker *and* the popup, at the same time. The background is not forwarding
anything.

So when the content script sends `EVAL` — run this mock's custom code — the
popup ignores it while the background picks it up, because only the background
subscribes to that type (`eval-dispatcher.ts`; likewise
`DISPATCH_TO_SERVER` in `server-dispatcher.ts`, both answered outside the
queue). The background's queue meanwhile handles the storage writes: `STORE`,
`STATE`, `RESPONSE`, `REQUEST`, `REMOVE`, `COOKIE`, `HITS`, `SET_COOKIES`,
`UPSERT` and `RESET`. Who handles what is decided purely by which
`payloadType` each context subscribes to.

Note `API_REQUEST` is not in either list: an intercepted request never crosses
`chrome.runtime` at all. It arrives from the injected script over
`window.postMessage` and the content script resolves it in place — only the
`EVAL` and `DISPATCH_TO_SERVER` detours above leave the tab.

The way back is different again: the popup answers the content script directly
with `chrome.tabs.sendMessage`, bypassing the background entirely.

## The envelope

```ts
interface IPacket<T = unknown, U = IOhMyPacketContext> {
  source: appSources;          // 'injected' | 'content' | 'popup' | 'background' | ...
  payload: IPacketPayload<T, U>;
  version?: string;            // guards against a stale content script
  tabId?: number;
}

interface IPacketPayload<T = unknown, U = IOhMyPacketContext> {
  id?: string;                 // correlation id — set it when you expect an answer
  type: payloadType;
  context?: U;
  data?: T;
  description: string;         // free text, for tracing in the console
}
```

`description` is required on purpose: every send names itself
(`'content;response'`, `'popup;updateAux'`), which is what makes a console dump
of the traffic legible.

## Request/response over a fire-and-forget channel

None of these transports have a native request/response pairing that survives a
context hop, so the codebase does it by hand:

1. the sender mints `id = uniqueId()` and puts it in `payload.context.id`
2. it subscribes with `streamById$(id, expectedSource)` and `take(1)`
3. the receiver echoes the same context back
4. the sender's subscription fires, and it unsubscribes

`sendMsg2Popup` (`content/message-to-popup.ts`) adds a 5-second timeout to that
pattern and rejects with an `IOhMyPopupError`. Nothing on the serving path uses
it any more — custom mock code goes to the background now, which is always
there — so the timeout is no longer a stall anyone sees; the one remaining
caller is the PING/PONG liveness check in `content/index.ts`.

## Two contexts, deliberately different types

A packet posted by the injected script carries `{ id, requestType }` and nothing
else: the page world does not know which domain the extension keys its state on.
That is added on the content hop by `OhMySendToBg`.

Hence two types, which used to be one:

- **`IOhMyContext`** — *state* context. Has a required `preset`, because every
  lookup into `data.selected` / `data.enabled` indexes by it.
- **`IOhMyPacketContext`** — *message* context. Everything optional except what
  the sender genuinely knows.

Collapsing them forced `preset` to be optional everywhere, which meant every
lookup site had to defend against a case that could not happen in a state.

## Security: the window channel is public

`window.postMessage` can be posted to by any script in the page, in an iframe,
or in an opener. `triggerWindow` therefore checks both:

```ts
if (ev.source !== window || ev.origin !== window.location.origin) {
  return;
}
```

The `source` check is the one that matters — it rules out other frames. Senders
address this document's own origin rather than `'*'`, so packets carrying cached
API responses are not readable by other frames.

## Things worth knowing

- **The bus uses a `Subject`, not a `BehaviorSubject`.** It used to be the
  latter, which re-emits its last value to every new subscriber — so any stream
  subscribed after traffic had flowed immediately re-handled an old message.
- **Unsubscribing is not automatic.** Teardown handles go on
  `ohMyWindow().off`, which holds both plain callbacks and RxJS `Subscription`s;
  `content/index.ts` branches on `typeof h === 'function'` for that reason.
- **Version mismatches are fatal by design.** `handle-api-request.ts` compares
  `packet.version` with its own build; a mismatch means the extension was updated
  under a still-open page, and the content script tears itself down rather than
  talk to a bundle it does not match.
