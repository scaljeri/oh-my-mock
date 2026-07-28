# Normalising requests out of the domain record

**Status: done.** Option 3 was implemented as designed. What follows is the
reasoning that led there, kept because it explains why the lookups take a
requests map instead of loading one. Where the outcome differs from the plan:

- **The migration is a real lift-out, and it is not a migration step.**
  `src/background/lift-out-requests.ts` runs from `initStorage` and moves every
  embedded request into a record of its own. It is keyed on the **shape** — a
  state that still has `data` — rather than on the version, which makes it
  idempotent and, unlike the step chain, guaranteed to run. See "The migration"
  below.
- **A `REQUEST` payload type carries request writes.** `OhMyRequestHandler`
  (`src/background/handlers/request-handler.ts`) stores the record and, only
  when the id is new, patches `$.requests` on the domain record through the
  state queue. The remove handler patches the same field the same way; they are
  the only two writers of the list.
- `StateUtils` gained `hasRequest` and `pickRequests`, and `removeRequest` now
  returns the state rather than the removed request.

## The problem, measured

`chrome.storage` today holds three kinds of record:

```
'OhMyMock'  ->  IOhMyMock   which domains exist
<domain>    ->  IState      everything about one domain, requests included
<mockId>    ->  IMock       one stored response
```

Responses are already normalised — each is its own record. Requests are not:
`IState.data` is a `Record<ohMyDataId, IData>` embedded in the domain record.

That matters more than "saving a mock is wasteful", because of one line in
`src/content/handle-api-request.ts`:

```ts
data.lastHit = Date.now();
OhMySendToBg.patch(data, '$.data', data.id, payloadType.STATE);
```

**Every intercepted request that has a mock rewrites the entire domain record**,
to update a timestamp. A page making fifty calls rewrites it fifty times, each
write carrying every request the domain knows about.

## The shape to move to

```ts
export interface IState {
  // ids only; each request is its own record in chrome.storage
  requests: ohMyDataId[];
}
```

This is what `feature/refactor-data-model-142` did (as `IOhMyDomain.requests`),
and it is the right call — see `docs/branch-inventory.md`.

## The decision that needs making first

`StateUtils.getRequest / setRequest / removeRequest / findRequest` all operate on
`state.data` synchronously, and about twenty call sites rely on that. Once the
requests live elsewhere, those functions need the objects from somewhere.

Three options were considered:

1. **Make them async and load on demand.** Rejected: `findRequest` is on the hot
   path — it runs for every intercepted request — and an `await` per lookup
   turns a synchronous cache read into a storage round trip.
2. **Two types, persisted and hydrated.** A persisted `IState` with `requests:
   string[]` and a hydrated view carrying the objects. Cleanest conceptually,
   most churn, and easy to get wrong at the boundary.
3. **Pass the requests explicitly** — `StateUtils.findRequest(state, requests,
   search)`, where `requests` is a `Record<ohMyDataId, IData>` the caller already
   holds. **This is the recommended one.** Both `OhMyContentState` and the
   popup's `OhMyStateService` already cache storage records by key and listen to
   `chrome.storage.onChanged`, so both can hold the map and keep it fresh
   without a new mechanism. Reads stay synchronous; writes become one small
   record.

## Scope, measured

Changing `IState.data` to `IState.requests` produces **78 type errors** —
56 in the Angular app, 22 in the extension bundles. Concentrated in:

| File | Errors |
|---|---|
| `app/components/data-list/data-list.component.ts` | 17 |
| `shared/utils/state.ts` | 15 |
| `app/services/oh-my-store.ts` | 8 |
| `shared/utils/preset.ts` | 4 |
| `app/pages/state-explorer/state-explorer.component.ts` | 4 |
| `app/pages/json-export/json-export.component.ts` | 4 |
| the rest | 4 |

Most are mechanical (`state.data[id]` becomes a lookup in the passed map); the
thinking is concentrated in `state.ts`.

## The migration

There is no *published* installed base, but there are development profiles with
real mocks in them — so the requests are lifted out rather than dropped. It lives
in `src/background/lift-out-requests.ts`, called from `initStorage` before
anything reads a domain record.

For each stored domain record that still has `data`, it:

1. writes every `data[id]` as its own `chrome.storage` record under `id`
2. replaces `data` with `requests: Object.keys(data)`

**Why not a `MigrateUtils` step.** Two independent reasons, either one fatal:

- A step is handed one record and can only return that record. Lifting requests
  out means *creating* other records, which a step cannot do — so the step could
  only ever have deleted `data`, losing every stored mock.
- Steps are version-gated: `shouldMigrate` compares the stored version with the
  extension's, and this change carries no version bump. The gate would never
  open, leaving profiles in the old shape while the new code read
  `state.requests` as `undefined`.

Keying on the shape instead solves both. It runs whenever an old-shaped record
is found, and once none is left it is a no-op — so it is safe on every startup.

The step in `migrations/state.ts` now only guarantees the field exists
(`requests ??= []`). It must **not** delete `data`.

**Request ids share a keyspace with mock ids** — both come from `uniqueId()`, ten
characters of base 36. A collision is unlikely but not impossible, and this is
the moment it would surface. The lift-out checks the occupant's `type`: an
existing *request* record is the new code's own and is left alone, while any
other record means a genuine collision — that id is reported through `error()`
and left out of `requests`, because overwriting would destroy a stored mock and
listing it would point the domain at the wrong record.

## Also update

- `tests/fixtures/oh-my-mock.ts` seeds `state.data[dataId]` directly; it will
  need to write request records and a `requests` array. The e2e suite is the
  thing that will catch a half-applied model change, so update it deliberately
  rather than making it pass.
- `docs/architecture/request-flow.md` describes the storage layout; the table at
  the end names `IData` as living inside the domain state.
