# Cookie mocking

Design notes, and what was built from them. The background side exists:
`background/cookie-jar.ts` applies and unapplies, `background/cookie-sync.ts`
decides when, `background/handlers/cookie-handler.ts` is the CRUD, and
`background/cookie-recorder.ts` picks up what a server sets. There is no UI yet
— the Cookies tab in `design/Mock Manager v2` is still only a design.

## The constraint that shapes everything

**A mocked response never touches the cookie jar.**

`ohMyFetch` fabricates its answer in the page with `new Response(null, {status})`
(`src/injected/mock-oh-fetch.ts`). The browser does not see that as a network
response, so a `Set-Cookie` header stored in `mock.headersMock` is just data —
nothing processes it.

Cookie mocking therefore cannot ride on the response-mocking mechanism. It is a
separate path, not an extra field on a response. That is almost certainly where
the earlier attempt stalled: the stub hung `cookies: IOhMyCookie[]` off
`IOhMyResponse`, which is the one place it cannot work from.

## What actually does the work

`chrome.cookies` — read, write and delete, with full control over `httpOnly`,
`secure`, `sameSite`, `path`, `domain` and `expirationDate`. It needs the
`cookies` permission; the host permissions are already there (`<all_urls>`).

For *recording* what a server sets, this document originally assumed
`declarativeNetRequest` could read `Set-Cookie` the way
`background/handlers/remove-csp-header.ts` rewrites `Content-Security-Policy`.
**It cannot.** DNR is declarative in both directions: a rule says what to do
with a header without ever seeing its value, and no event hands the extension a
matched response. `onRuleMatchedDebug` reports that a rule matched — and only
for unpacked extensions — never the headers. DNR can strip or overwrite a
`Set-Cookie`; it can never say what one contained.

Two APIs can. `webRequest.onHeadersReceived` gives the raw header, but needs the
`webRequest` permission on top of what is already asked for, and `extraHeaders`
before `Set-Cookie` is visible at all. `chrome.cookies.onChanged` needs neither:
it fires once the browser has accepted the cookie, with everything a mock stores
already parsed, under the `cookies` permission the jar needs anyway. That is
what `background/cookie-recorder.ts` uses. The price is that it cannot say which
response set the cookie, and does not distinguish `Set-Cookie` from a
`document.cookie` write — neither of which matters for filling in a mock.

## httpOnly stays on

An early idea was to strip `httpOnly` inside the extension so cookies become
visible to page scripts. **Decided against, and it is not needed.**

Not needed, because the extension is not the page. `chrome.cookies.set()` takes
`httpOnly` as a parameter, and `getAll()` returns httpOnly cookies. Everything
below runs in the background service worker, which has that access. Only the
injected script would have needed the flag gone, and it is not the right place
for this.

Harmful, because:

1. **It weakens the site under test.** `httpOnly` exists to keep session cookies
   away from XSS. Removing it makes an XSS bug in the app exploitable exactly
   while someone is developing against it.
2. **It changes what is being tested.** Code that depends on a cookie *not*
   being readable behaves differently, so a bug that depends on it stays hidden
   in development and appears in production.
3. **There is already one instance of this pattern.** The extension strips
   `Content-Security-Policy` headers to get its script injected — recorded as a
   real weakening in [interception.md](./interception.md). A second one makes it
   a habit.

If a page needs to read a mocked cookie, mock it *as* a non-httpOnly cookie.
That is a property of the mock, not a global change to the site's behaviour.

## What cookie mocking is actually good for

Worth being clear about, because it is narrower than it first looks. Cookies are
sent by the browser on requests that **reach the network**. A request OhMyMock
mocks never leaves the browser, so cookies play no part in it.

So the useful cases are:

- a request that **passes through** to the real server needs a session cookie
  the developer does not have — mock the cookie, not the response
- the **page load itself** needs a cookie (feature flags, locale, A/B bucket)
- the app's own JS reads a **non-httpOnly** cookie and should see a chosen value
- reproducing a state that is awkward to reach by logging in

## Where it fits in the model

Cookies belong beside requests, not inside responses — which matches the design,
where Cookies is a tab next to Requests:

```
'OhMyMock'   ->  IOhMyMock     which domains exist
<domain>     ->  IState        one domain
<mockId>     ->  IMock         one stored response
<cookieId>   ->  IOhMyCookie   one cookie mock          <- new
```

A first shape, deliberately closer to `chrome.cookies` than the old stub's
`{ key, value }`, because those fields are what the API needs and what
determines whether a cookie is actually sent:

```ts
export interface IOhMyCookie {
  id: ohMyCookieId;
  version: string;
  type: objectTypes.COOKIE;

  name: string;
  value: string;
  path?: string;          // defaults to '/'
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: chrome.cookies.SameSiteStatus;
  expirationDate?: number; // absent = session cookie

  label?: string;
  enabled: Record<ohMyPresetId, boolean>;  // per preset, like requests
}
```

Note `enabled` per preset: a preset is meant to describe a whole scenario, and
"logged out" is as much a cookie state as a response state.

## Applying and unapplying

In the **background**, the only context with `chrome.cookies`. Not per request —
cookies are domain state, not an answer to a call.

- when a domain becomes active, `chrome.cookies.set` each enabled cookie mock
- when it goes inactive, or a mock is disabled, remove what was applied
- keep track of what the extension itself set, so switching off restores the
  user's own cookies rather than deleting whatever happens to be there

That last point is the one to get right. Overwriting a real session cookie and
then deleting it on toggle-off would log the developer out of the site they were
testing. Record the previous value before overwriting, and restore it.

Its sharper form, learned while wiring this up: **only ever remove a cookie this
service worker put there itself**. Switching off a mock that was never on, or
deleting one, or starting a fresh worker, all reach the same "this mock should
not be applied" branch — and in each of those the cookie sitting in the jar is
the site's own. `syncCookies` and the delete path both check `isApplied` first.

## When the sync runs

Everything a sync depends on ends up in `chrome.storage`: the on/off toggle
(`aux.appActive`) and the selected preset are on the state, and each cookie mock
is a record of its own. So the trigger is `chrome.storage.onChanged` rather than
a call at each site that changes something — which also catches writes the popup
makes without a message reaching the background. `cookie-sync.ts` keeps a
per-domain signature of `(active, preset, cookie ids)` so the many state writes
that have nothing to do with cookies cost nothing.

Cookies follow `aux.appActive` alone, not the popup. Response mocking also
requires the popup to be open because the popup hosts the sandbox that evaluates
mock code; a cookie needs nothing from it, and dropping a mocked session every
time the window closes would be a surprise.

## The permission

`cookies` has to be added to `manifest.json`. Normally that would force every
existing user to re-accept the permissions on update, which is a product call
rather than a technical one — but the extension is no longer published and has
no installed base, so it is free to take.

> Written against MV3 as of mid-2026; these APIs move. Re-verify
> `chrome.cookies` and the `declarativeNetRequest` response-header capabilities
> against current documentation before building.
