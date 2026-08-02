# Mock groups

**Status: agreed design, not built.** Nothing in `src` implements this yet. It is
written down so the shape stops being reconstructed from scratch every time, and
so the parts that are *decided* can be told apart from the parts that are not.

## The problem it solves

Mocks will come from more than one place: this browser's own storage, a mock
server someone runs, and — later — a cloud service that people share mocks
through. The obvious way to combine them is to merge, and merging is where every
version of this design fell over.

Merging means deciding what happens when both sides have something for the same
endpoint, and the identity of an endpoint here is *fuzzy*. `IData.url` is a
**regular expression**, not a url: one person writes `/api/users`, another writes
`(https?://api\.acme\.com)?/api/users.*`. Those are not equal, and they match the
same call. `findExistingRequest` in `har-import.ts` exists precisely because of
this — it does a deliberately loose match so the HAR dialog can leave colliding
rows unticked rather than guess.

So: **nothing merges.** A set of mocks stays a set. You switch sets on, and one
of them answers.

## The model

A **mock group** is a named set of mocks with a source and one or more domains.
It is close to what already exists — today's per-domain `IState` *is* a group in
all but name — plus:

| | |
| --- | --- |
| **name** | what it is called in the sidebar |
| **source** | `local` (this browser), `server` (the SDK), `cloud` |
| **domains** | one, usually. The list lives on the group; a request has no domain field of its own, and there is no reason to give it one |
| **order** | groups are sortable, and the order decides who answers |

Rules:

- Opening a domain **activates every group that covers it**, automatically.
- Clicking a group **toggles it off** for that domain. That exception has to be
  remembered somewhere, or it comes back on the next visit.
- When two active groups both know an endpoint, **the higher one answers**. That
  is a visible, draggable rule — not a fallback. An invisible layer underneath is
  exactly what was rejected: see `remote.target` in
  [store.ts](../../src/shared/types/store.ts), which replaced the SDK-overrides-
  storage behaviour for the same reason.

## Two views, two different things

This is the part that matters most, and the part that was wrong in the first
sketch.

**The request list is traffic.** It shows the calls the page actually made — not
a library of what could be mocked. Each row carries a badge saying which group
answered it, or that nothing did. A **Clear** button above it empties the list,
the way a network panel does; the mocks are unaffected, because they live in
groups rather than in the list.

**The group view is the library.** What a group holds, where it came from, and
what can be edited. It has to exist: with the list showing only real traffic, a
colleague's forty mocks are otherwise invisible until you happen to trigger all
forty calls, and there is nowhere to prepare a mock for a call you have not made
yet.

Shadowing becomes readable this way. One row, one badge, naming the winner — but
it needs to hint that there *were* other candidates, or someone edits a mock that
never answers and cannot see why. A `+1` on the badge, listing the others on
hover.

## What this changes in the code

Three things are known to be in the way:

1. **The request list is not traffic today.** It shows every stored request,
   called or not — `+ Add` creates one, and a HAR import creates forty.
2. **`lastHit` does not mean "was called".** `DataUtils.create` sets it to
   `Date.now()` for a request made by hand. "Actually called" needs a field the
   interception is the only writer of.
3. **The sidebar is the domain switcher.** If it becomes the group list, that
   navigation has to go somewhere.

## The sources

`local` and `server` are what they sound like. **`cloud` pulls into local
storage** — it is not consulted per request.

Not because it cannot be: the background may `fetch` any url, `host_permissions`
is `<all_urls>`, and `server-dispatcher.ts` is already exactly the right shape.
It is because of what it would cost. Every intercepted call would wait on an
internet round trip; mocking would stop working offline, which is often the very
reason to mock; and a slow or down cloud would stall the page. That last failure
mode is not hypothetical here — it is what the popup-hosted sandbox did, a 5s
timeout per request before letting it through unmocked.

Fetching on first hit and remembering the answer gets the live feel without the
failure modes. Either way, **serving happens from local storage**.

One trap for whoever builds the pull: `importJSON` **does not deduplicate**. It
stores what it is given, so importing twice leaves two requests for one url and
`findRequest`, which answers with the first match, picks between them
arbitrarily.

## Still open

- **What the sidebar becomes.** Two levels (domain, then groups), or groups for
  the current domain with the domain coming from the tab.
- **Is the order global or per domain?** Global is simpler. Per domain is what
  people will expect once a group covers several.
- **Editing a mock that came from someone else.** Detaching it on save keeps a
  later sync from silently reverting your change, but muddies where it came from.
  Making it read-only until copied is stricter and more honest.

## How this relates to presets

Watch this one. There will be two named-set concepts on screen: **presets**
(which of a request's responses is served, per preset) and **groups** (whose
mocks these are). They are orthogonal — a group brings mocks in, a preset chooses
among them — but they look identical in a UI: a name, and on or off. Either pull
them apart visually, or fold one into the other.
