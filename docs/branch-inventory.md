# What is worth taking from the old branches

An inventory of the nine stale branches on `origin`, made before starting the
redesign. The question was not "can we merge this" — most of it is years behind
— but "which ideas are worth keeping".

Short answer: **one branch matters**, and what is valuable in it is the data
model, not the code.

## The branches

| Branch | Last commit | Size | Verdict |
|---|---|---|---|
| `feature/refactor-data-model-142` | 2023-12-20 | 12 commits, 134 files | **Read it.** Ideas below |
| `feature/149-sticky-list` | 2024-01-30 | 1 commit, 7 files | UI tweak, superseded by the redesign |
| `feature/136` | 2022-06-13 | 6 commits, 18 files | merged in substance; nothing left |
| `demo-site` | 2022-05-05 | — | flattened copy of the old test site, now replaced |
| `migration-v3` | 2021-12-24 | 1 commit, 11 files | the MV3 move; long since done |
| `fix/early-calls` | 2021-10-05 | 1 commit, 5 files | became `src/early-inject` |
| `feature/71-search-field` | 2021-06-21 | 21 commits, 47 files | shipped; branch is pre-v3 |
| `fix/reset-state-part1`, `fix/mock-xhr`, `fix/refactor` | 2021 | small–20 commits | pre-MV3, pre-Angular 14. Code is unusable |

Everything from 2021–2022 predates both the MV3 migration and the Angular 22
upgrade. Treat those as history, not as source material.

## The cookie work you remember

It is in `feature/refactor-data-model-142`, and it is **a type stub, not an
implementation** — `src/shared/types/response.ts`:

```ts
export interface IOhMyCookie {
  // httpOnly: boolean
  key: string;
  value: string;
}

export interface IOhMyResponse {
  // ...
  cookies: IOhMyCookie[];
}
```

That is the whole of it. No `cookies` permission in the manifest, no
interception, no UI. The commented-out `httpOnly` is the interesting part: it is
the field that decides whether the page can even see the cookie, and it is
exactly where a cookie feature gets difficult.

So: the intent was recorded, the design question was not answered. Nothing to
salvage in code, but it confirms cookies were meant to hang off a **response**,
which matches the redesign mockups showing a Cookies tab beside Requests.

## What is genuinely worth taking

Five ideas from that branch, in order of value. Each is a modelling decision the
current code still gets wrong.

### 1. `IOhMyContext` as a discriminated union

The branch splits it by a `type` tag:

```ts
export type IOhMyContext = IOhMyDomainContext | IOhMyPropertyContext;

export interface IOhMyDomainContext {
  type: contextTypes.DOMAIN;
  key: IOhMyDomainId;
  presetId?: IOhMyPresetId;
}

export interface IOhMyPropertyContext {
  type: contextTypes.PROPERTY;
  path: string;
  propertyName: string;
}
```

This is the same problem that forced the recent split into `IOhMyContext` and
`IOhMyPacketContext` — one type doing two jobs, so every field had to be
optional. A tagged union is the better answer: the compiler narrows on `type`
instead of every call site guessing. Note the current `path` / `propertyName`
fields on `IOhMyPacketContext` are exactly the "property context" case.

### 2. `popupActive` belongs to the store, not to a domain

```ts
export interface IOhMyMock {
  domains: IOhMyDomainId[];
  popupActive: boolean;   // <- global, not per domain
  // ...
}
```

Today it lives in each domain's `aux`, which says a popup can be open for one
domain and closed for another. It cannot. This is small, and it touches the
extension's most confusing behaviour — see
[architecture/interception.md](./architecture/interception.md).

### 3. `IState` → `IOhMyDomain`, with requests normalised

```ts
export interface IOhMyDomain {
  domain: IOhMyDomainId;
  requests: IOhMyRequestId[];        // ids, not embedded objects
  presets: Record<IOhMyPresetId, IOhMyPreset>;
  context: IOhMyDomainContext;
}
```

Two changes in one. The rename says what the thing is — "state" describes
nothing. The normalisation matters more: today every request is embedded in the
domain record, so touching one mock rewrites the whole domain in
`chrome.storage`. Responses were already stored separately by id; this does the
same for requests.

### 4. Presets as objects

`Record<IOhMyPresetId, IOhMyPreset>` where a preset is `{ id, label }`, instead
of today's `Record<presetId, string>` mapping an id to a display name. It gives
a preset somewhere to grow — a description, an ordering, an enabled flag.

### 5. Typed action payloads (`types/modifiers.ts`)

Explicit shapes per operation: `IOhMyResponseUpsert`, `IOhMyRequestDelete`,
`IOhMyRequestUpsert`, and so on. This is the missing piece behind a real bug
found this week: `OhMyQueue.addPacket(packetType, packet: unknown)` accepts
anything, which is why a handler that queued a bare state object as a *payload*
compiled for years and silently corrupted the store.

Also worth copying, cheaply: per-concept type files (`types/request.ts`,
`types/response.ts`, `types/domain.ts`, …) instead of one `type.ts`, and the
consistent `IOhMy*` prefix.

## What to do with it

Do not merge the branch. It is 134 files against a codebase that has since moved
through MV3, Angular 22 and full strict mode; the merge would be a rewrite with
extra steps.

Take the five ideas as separate, tested changes. Suggested order — cheapest and
most useful first:

1. `popupActive` to the store (small, and it unblocks thinking about the popup
   requirement)
2. Typed action payloads + tighten `addPacket` (closes a proven bug class)
3. Per-concept type files and naming (mechanical, no behaviour change)
4. Context as a tagged union (replaces the current two-type split)
5. Domain rename + request normalisation (largest; needs a storage migration)

The branch also carries a `src/app/migrations/current-domain.ts`, so whoever
attempts 5 should read that first rather than start from nothing.
