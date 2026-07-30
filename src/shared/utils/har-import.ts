import { objectTypes } from '../constants';
import { IData, ohMyDataId, requestMethod, requestType } from '../types/request';
import { IMock, IOhMyShallowMock, ohMyMockId } from '../types/mock';
import { ohMyPresetId } from '../types/preset';
import { DataUtils } from './data';
import { IOhMyHarEntry, IOhMyHarSkip, HAR_SKIP_LABELS, harSkipReason } from './har-parse';
import { IOhMyBackupInput } from './import-json';
import { MigrateUtils } from './migrate';
import { MockUtils } from './mock';
import { uniqueId } from './unique-id';
import { compareUrls } from './urls';

/**
 * Turning parsed HAR entries into the extension's own model.
 *
 * The result is an `IOhMyBackupInput` — the exact same shape `importJSON`
 * already takes for a `.json` backup — so a HAR lands through the one existing
 * import path rather than through a second way of creating requests. Everything
 * specific to HAR happens here and in `har-parse.ts`; nothing downstream knows
 * a HAR exists.
 */

/**
 * One request that will be created, with every response the file recorded for
 * it. This is what the import dialog lists and the user picks from.
 */
export interface IOhMyHarCandidate {
  /** `FETCH GET https://…` — unique per candidate, and the row's `trackBy`. */
  key: string;
  method: requestMethod;
  requestType: requestType;
  /** The absolute url, as recorded. */
  url: string;
  host: string;
  /** Path and query — what the row shows. */
  path: string;
  /** The url that will be stored on the request. See `harUrlPattern`. */
  pattern: string;
  /**
   * One entry per distinct status code, in the order the codes first appeared.
   *
   * A HAR of a real session repeats the same call: a poll, a retry, a list
   * re-fetched after a save. Those become **one** request with one saved
   * response per status code rather than N identical requests, because that is
   * what the model is for — `IData.mocks` is a set of answers to choose
   * between, and N copies of a url would make the list unreadable and the
   * lookup ambiguous (`findRequest` returns the first match).
   *
   * When one status code occurs more than once, the **last** occurrence wins:
   * of two 200s for a list endpoint, the later one is the list as the session
   * left it. Which of the codes is *selected* is a separate question — see
   * `statusCode` below.
   */
  responses: IOhMyHarEntry[];
  /** How many entries of the file this candidate stands for. */
  occurrences: number;
  /**
   * The status code of the response that gets selected: the **lowest** one
   * recorded.
   *
   * A session that polled an endpoint until it failed holds both a 200 and a
   * 500 for it, and importing the 500 as the active mock would hand back a
   * broken app. The lowest code is also what the rest of the extension treats
   * as a request's default answer — `DataUtils.prefillWithPresets` picks
   * `responses[0]` after `statusCodeSort`. The others are saved alongside it
   * and are one click away in the detail pane.
   */
  statusCode: number;
  /** The content type of the response that gets selected. */
  mimeType: string;
  /** Size of the selected response, in bytes as the file reports them. */
  size: number;
  /** False when the file recorded no body at all for the selected response. */
  hasBody: boolean;
}

/**
 * What a HAR import hands to `importJSON`.
 *
 * `IOhMyBackupInput` types its records as `IOhMyStoredRecord` — "something that
 * may carry a version" — because a `.json` backup was written by an older
 * release and its records are not `IData`/`IMock` until they have been through
 * the migration steps. Records built here were built by *this* release, so this
 * narrows both lists back to the real types. It stays assignable to
 * `IOhMyBackupInput`, so `importJSON` takes it unchanged and no cast is needed
 * at either end.
 */
export interface IOhMyHarBackup extends IOhMyBackupInput {
  requests: IData[];
  responses: IMock[];
  version: string;
}

export interface IOhMyHarImportOptions {
  /** The preset of the *target* domain the requests are selected in. */
  preset: ohMyPresetId;
  /** Put on every response, so an imported mock says where it came from. */
  label?: string;
  /**
   * Defaults to `MigrateUtils.version` — the version `shouldMigrate` compares
   * against, so records built here are never run through the migration steps.
   */
  version?: string;
  /** Base for `lastHit` when an entry has no usable timestamp. */
  now?: number;
}

/**
 * Groups entries into one candidate per request the extension can key on.
 *
 * The key is `requestType + method + url`, all three of which take part in the
 * lookup: `StateUtils.findRequest` compares the method and the request type by
 * equality, so an `XHR` and a `fetch` to the same url are genuinely two
 * different requests and must not be merged.
 */
export function groupHarEntries(entries: IOhMyHarEntry[]): IOhMyHarCandidate[] {
  const candidates = new Map<string, IOhMyHarCandidate>();

  for (const entry of entries) {
    const key = `${entry.requestType} ${entry.method} ${entry.url}`;
    const existing = candidates.get(key);

    if (!existing) {
      candidates.set(key, {
        key,
        method: entry.method,
        requestType: entry.requestType,
        url: entry.url,
        host: entry.host,
        path: entry.path,
        pattern: harUrlPattern(entry.origin, entry.path),
        responses: [entry],
        occurrences: 1,
        statusCode: entry.statusCode,
        mimeType: entry.mimeType,
        size: entry.size,
        hasBody: entry.body !== undefined
      });

      continue;
    }

    existing.occurrences++;

    const at = existing.responses.findIndex(r => r.statusCode === entry.statusCode);

    if (at === -1) {
      existing.responses.push(entry);
    } else {
      existing.responses[at] = entry; // last occurrence of this status code wins
    }
  }

  return [...candidates.values()].map(candidate => ({
    ...candidate,
    ...describeSelected(candidate.responses)
  }));
}

/** The fields that follow whichever response will be the selected one. */
function describeSelected(
  responses: IOhMyHarEntry[]
): Pick<IOhMyHarCandidate, 'statusCode' | 'mimeType' | 'size' | 'hasBody'> {
  const selected = responses.reduce((lowest, entry) =>
    entry.statusCode < lowest.statusCode ? entry : lowest);

  return {
    statusCode: selected.statusCode,
    mimeType: selected.mimeType,
    size: selected.size,
    hasBody: selected.body !== undefined
  };
}

/**
 * The url stored on the request: the path, with the origin optional.
 *
 * `IData.url` is used as a **regular expression** — `compareUrls` anchors it
 * and matches the intercepted url against it — and the intercepted url is
 * whatever the page passed to `fetch`/`open`, which may be relative
 * (`/v1/users`) or absolute (`https://api.example.com/v1/users`). A HAR only
 * ever records the absolute form, so storing that verbatim would miss every
 * page that calls its API relatively, and storing the bare path would miss
 * every cross-origin call. Making the origin an optional group matches both.
 *
 * The literal parts are escaped in full. `url2regex`, used when a request is
 * created by hand, escapes only `.` and `?` so that a hand-written url can
 * still carry a wildcard; an imported url is not hand-written, and an
 * unescaped `(` or `+` from a real url would make `compareUrls` throw a
 * `SyntaxError` inside the content script's lookup.
 */
export function harUrlPattern(origin: string, path: string): string {
  // The recorded scheme is relaxed to `https?` so a session captured over
  // https still matches the same app served over http in development.
  const originRe = escapeRegExp(origin).replace(/^https?/, 'https?');

  return `(${originRe})?${escapeRegExp(path)}`;
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Maps the picked candidates onto records `importJSON` can store.
 *
 * Every response is built with `MockUtils.init`, which is what gives it the
 * untouched default `jsCode`. That is load-bearing: a mock whose code is the
 * default is served by the content script alone, while an edited one can only
 * be served while the popup is open. An imported session has to work with the
 * popup closed. See `docs/architecture/request-flow.md`, "The fork".
 */
export function harCandidatesToBackup(
  candidates: IOhMyHarCandidate[], options: IOhMyHarImportOptions
): IOhMyHarBackup {
  const version = options.version ?? MigrateUtils.version;
  const base = options.now ?? Date.now();
  const requests: IData[] = [];
  const responses: IMock[] = [];

  candidates.forEach((candidate, index) => {
    const mocks: Record<ohMyMockId, IOhMyShallowMock> = {};
    let selected: ohMyMockId | undefined;

    for (const entry of candidate.responses) {
      const mock = toMock(entry, options.label);

      responses.push(mock);
      mocks[mock.id] = MockUtils.createShallowMock(mock);

      if (entry.statusCode === candidate.statusCode) {
        selected = mock.id;
      }
    }

    requests.push(toRequest(candidate, mocks, selected, {
      preset: options.preset,
      version,
      lastHit: lastHitOf(candidate, base + index)
    }));
  });

  return { requests, responses, version };
}

function toMock(entry: IOhMyHarEntry, label?: string): IMock {
  return MockUtils.init({
    statusCode: entry.statusCode,
    // `response`/`headers` are what was recorded; `responseMock`/`headersMock`
    // are what gets served. `MockUtils.init` copies one into the other, which
    // is the only reason this reads as if it set the served body directly —
    // setting `response` alone would yield a mock that serves nothing.
    response: entry.body ?? '',
    headers: entry.headers,
    ...(label !== undefined && { label })
  });
}

function toRequest(
  candidate: IOhMyHarCandidate,
  mocks: Record<ohMyMockId, IOhMyShallowMock>,
  selected: ohMyMockId | undefined,
  meta: { preset: ohMyPresetId; version: string; lastHit: number }
): IData {
  const id: ohMyDataId = uniqueId();

  // The `id` is passed deliberately: `DataUtils.create` runs `url2regex` over
  // the url only when it is creating a brand new request without one, and the
  // pattern built above is escaped already.
  return DataUtils.create({
    id,
    url: candidate.pattern,
    // `url` is the regex the interception matches against; this is the url it
    // was built from, so the list shows `https://api.example.com/v1/users`
    // rather than `(https?://api\\.example\\.com)?/v1/users`.
    displayUrl: candidate.url,
    method: candidate.method,
    requestType: candidate.requestType,
    mocks,
    ...(selected && { selected: { [meta.preset]: selected } }),
    // Imported mocks are switched on: the point of importing a session is to
    // replay it. The domain's own on/off switch still gates all of it.
    enabled: { [meta.preset]: true },
    lastHit: meta.lastHit,
    lastModified: meta.lastHit,
    version: meta.version,
    type: objectTypes.REQUEST
  });
}

/**
 * `lastHit` from the moment the call was recorded.
 *
 * What survives of it is the *order*: `importJSON` sorts the requests it is
 * given by `lastHit` and then re-stamps them with a clock of its own, so this
 * decides where each one lands in the list, not what the list says. Falls back
 * to the given default when the file has no timestamp, or an unparseable one.
 */
function lastHitOf(candidate: IOhMyHarCandidate, fallback: number): number {
  const started = candidate.responses[candidate.responses.length - 1]?.startedDateTime;
  const parsed = started ? Date.parse(started) : NaN;

  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * The request already stored for this candidate, if there is one.
 *
 * `importJSON` does not deduplicate — it stores every record it is given — so
 * importing a HAR twice would leave two requests for one url and
 * `findRequest`, which answers with the first match, would pick between them
 * arbitrarily. The dialog uses this to leave such rows unselected instead.
 */
export function findExistingRequest(
  candidate: IOhMyHarCandidate, requests: IData[]
): IData | undefined {
  return requests.find(request =>
    request.method === candidate.method &&
    request.requestType === candidate.requestType &&
    (request.url === candidate.pattern ||
      matchesUrl(candidate.url, request.url) ||
      matchesUrl(candidate.path, request.url)));
}

function matchesUrl(url: string, storedUrl: string): boolean {
  try {
    return compareUrls(url, storedUrl);
  } catch {
    // A stored url is a regular expression, and one written by hand may not be
    // a valid one. That is not a reason to fail the import: it only means this
    // candidate is not the request in question.
    return false;
  }
}

export interface IOhMyHarSkipSummary {
  reason: harSkipReason;
  label: string;
  count: number;
}

/** The skipped entries grouped by reason, biggest group first. */
export function summariseHarSkips(skipped: IOhMyHarSkip[]): IOhMyHarSkipSummary[] {
  const counts = new Map<harSkipReason, number>();

  for (const skip of skipped) {
    counts.set(skip.reason, (counts.get(skip.reason) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, label: HAR_SKIP_LABELS[reason], count }))
    .sort((a, b) => b.count - a.count);
}
