# Normalising requests out of the domain record

Design notes for the largest open refactor. The analysis is done; the
implementation is not. Written so the next attempt starts from a decision rather
than from an investigation.

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

**There is no installed base** — the extension is not published — so this is a
convenience for whoever has a development profile open, not a contract with
users. If it turns out to be the awkward part, wiping and re-recording is a
legitimate answer. That removes most of the risk from this refactor.

If written, it belongs alongside the step that drops `aux.popupActive` in
`src/shared/utils/migrations/state.ts`. For each stored domain record it must:

1. write every `state.data[id]` as its own `chrome.storage` record under `id`
2. replace `data` with `requests: Object.keys(data)`

Two things to be careful about:

- **Migrations run per record**, so a state migration cannot easily write *other*
  keys. This one has to, which may mean doing it in `background/init.ts` where
  `StorageUtils.get(null)` already reads everything, rather than in the per-record
  step chain.
- **Request ids share a keyspace with mock ids** — both come from `uniqueId()`,
  ten characters of base 36. Collisions are unlikely but not impossible, and the
  migration is the moment they would surface. Worth asserting no key is
  overwritten.

## Also update

- `tests/fixtures/oh-my-mock.ts` seeds `state.data[dataId]` directly; it will
  need to write request records and a `requests` array. The e2e suite is the
  thing that will catch a half-applied model change, so update it deliberately
  rather than making it pass.
- `docs/architecture/request-flow.md` describes the storage layout; the table at
  the end names `IData` as living inside the domain state.
