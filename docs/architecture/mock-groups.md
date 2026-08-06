# Mock groups

**Status: model, serving path and sidebar built.** The records, the resolution
and the migration exist (`src/shared/types/group.ts`, `src/shared/utils/group.ts`,
`src/background/ensure-groups.ts`); the serving path consults them through
`OhMyRequestIndex`, and the sidebar draws them (`domain-sidebar/`). The group
*view* — the library — is not built yet. The rest is written down so the shape
stops being reconstructed from scratch every time.

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

**A group does not list its requests.** Membership is a tag on the request,
`IData.groupId`, and **absent means the domain's own local group**. That keeps
one source of truth rather than a list on the group and an id on the request
that can drift apart — and it made the migration free: every request stored
before groups existed is already, by that default, the local group's. Tagging
them instead would have been a rewrite of every record in storage, which can
half-finish.

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
2. ~~**`lastHit` does not mean "was called".**~~ **Done.** `lastHit` still does
   not — `DataUtils.create` stamps it for a request made by hand, `importJSON`
   re-stamps every imported one, and both are right to, because it is the list
   *order*. "Actually called" is `IData.calledAt`, absent until the interception
   in `src/content/handle-api-request.ts` writes it, and absent on every record
   stored before it existed. Nothing else may write it, which is why `importJSON`
   and the export dialog strip it and `cloneRequest` drops it. No migration
   backfilled it: an old record cannot say whether its `lastHit` came from a real
   hit or from `DataUtils.create`, so backfilling would have re-told exactly the
   lie the field was added to stop. So the traffic list can be built on
   `calledAt` today; what it must not do is arrive before the group view.
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

## Settled since

- **The sidebar becomes the group list, with the domains as a filter row above
  it.** Not two levels: the groups are the thing being worked with, and burying
  them one expand deep makes the common act — switching a group off — the slow
  one. The domain row keeps the navigation that the sidebar is today.
- **The order is global**, the position in `IOhMyMock.groups`. A group covers
  one domain in almost every case, so a per-domain order would be the same list
  written out once per domain, each copy another thing to keep in step. It can
  become per-domain later without moving anything: global stays the default and
  a domain overrides it.
- **Switching a group off is per domain**, `IState.aux.disabledGroups`. It has
  to be: the toggle means "not here", and the group stays on for the other
  domains it covers. Storing the *exception* rather than the activation is what
  makes "a group that arrives already applies" work.
- **Being listed in `IOhMyMock.groups` is what makes a group exist.** Every
  reader gets its group ids from that list, so a record the list does not name
  cannot even be fetched on a fresh load — an earlier rule, "an unlisted group
  still serves, sorted last", was one only a tab that happened to overhear the
  record's write could follow, and gave the same group three answers. Unlisted
  now means deleted, or not yet adopted (`ensureGroups` adopts strays into the
  list when it scans); either way, not serving and not drawn. The one exception
  is a domain's own **local** group: its id is derived, so it exists by virtue
  of the domain and serves — sorted last — before its record is written or
  listed. `GroupUtils.coveringFor` is the single implementation of this rule;
  the sidebar draws it and `activeFor` serves it minus the switched-off rows.
- **A local group dies with its domain.** Deleting a domain used to leave the
  group record and its list entry behind for ever — and because the id is
  derived, re-adding the domain silently reused the leftover. `ensureGroups`
  prunes local groups whose domain is gone; `server` and `cloud` groups keep
  their records while their domains come and go.

## Still open

- **Editing a mock that came from someone else.** Detaching it on save keeps a
  later sync from silently reverting your change, but muddies where it came from.
  Making it read-only until copied is stricter and more honest.
- **What a `server` group holds.** The SDK answers live, so such a group has no
  stored requests — it is a source with a name. Whether it appears in the group
  list at all, or stays on the Remote mocking page, is not decided.

## How this relates to presets

Watch this one. There will be two named-set concepts on screen: **presets**
(which of a request's responses is served, per preset) and **groups** (whose
mocks these are). They are orthogonal — a group brings mocks in, a preset chooses
among them — but they look identical in a UI: a name, and on or off. Either pull
them apart visually, or fold one into the other.
