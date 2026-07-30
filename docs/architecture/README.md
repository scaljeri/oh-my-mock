# Architecture notes

Written for the parts of OhMyMock that cannot be understood by reading one file,
because the logic is spread across contexts that do not share memory.

| Document | Read it when |
|---|---|
| [request-flow.md](./request-flow.md) | you need to follow one request from `fetch()` to mocked answer |
| [messaging.md](./messaging.md) | you are adding or debugging a message between contexts |
| [interception.md](./interception.md) | you are wondering why this patches `fetch` instead of using an extension API |
| [request-normalisation.md](./request-normalisation.md) | you are picking up the open refactor that moves requests out of the domain record |
| [cookie-mocking.md](./cookie-mocking.md) | you are building the Cookies tab, or wondering why cookies cannot ride on the response mock |

## The shape of the thing in one paragraph

Five contexts. The **injected** script lives in the page's own JS world and is
the only one that can patch `fetch`; it has no `chrome.*` APIs at all. The
**content** script sits in the same tab in an isolated world, owns the state in
`chrome.storage`, and is the bridge. The **background** service worker holds the
optional websocket to the NodeJS SDK. The **popup** is an Angular app — an
editor for the mocks, and nothing the mocking path depends on. User-written mock
code is evaluated in a sandboxed iframe, held by an **offscreen document** the
background owns. Everything between them is messages.

## Things that surprise people

- **Mocks with custom code take a longer route** — they have to be *run*, and
  only a sandboxed page may `eval`, so the content script asks the background,
  which owns the offscreen document that holds the sandbox. Mocks with untouched
  code are served by the content script alone. See the fork in
  [request-flow.md](./request-flow.md#5-the-fork-fast-path-or-sandbox). This is
  no longer a reason to keep the popup open; it used to be.
- **A mocked `fetch` resolves with an empty `Response`.** The body is handed over
  later, when the page reads it, out of a cache keyed by url + method.
- **`chrome.runtime.sendMessage` is a broadcast**, not a relay: the background
  and the popup both receive it and pick by message type.
- **The window channel is public.** Any script in the page can post to it, which
  is why the receiver checks `event.source === window`.
- **`IOhMyContext` and `IOhMyPacketContext` are different on purpose.** A message
  from the page does not know the domain, let alone the preset.
- **A mocked response never reaches the cookie jar.** It is fabricated in the
  page, so the browser never processes its `Set-Cookie`. Cookie mocking needs
  `chrome.cookies`, from the background — see
  [cookie-mocking.md](./cookie-mocking.md).
