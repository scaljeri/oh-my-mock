# Cookie mocking

Design notes. Nothing is implemented — there is no cookie code in `src/` and
`manifest.json` has no `cookies` permission. The Cookies tab in
`design/Mock Manager v2` and the `IOhMyCookie` stub on
`feature/refactor-data-model-142` are the only traces of the idea so far.

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

For *recording* what a server sets, `declarativeNetRequest` can read and rewrite
`Set-Cookie` on real responses. The infrastructure exists — it is what
`background/handlers/remove-csp-header.ts` already does for
`Content-Security-Policy`.

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

## The permission

`cookies` has to be added to `manifest.json`. Normally that would force every
existing user to re-accept the permissions on update, which is a product call
rather than a technical one — but the extension is no longer published and has
no installed base, so it is free to take.

> Written against MV3 as of mid-2026; these APIs move. Re-verify
> `chrome.cookies` and the `declarativeNetRequest` response-header capabilities
> against current documentation before building.
