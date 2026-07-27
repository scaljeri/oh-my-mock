import { IData, IMock } from "../type";
import { isImage } from './image';
import { getMimeType } from "./mime-type";
import { FILTER_SEARCH_OPTIONS } from '../constants';

// const QUOTE_RE = /(?<=")([^"]+)(?=")(\s|\b)/gi;
const QUOTE_RE = /(?<=")([^"]+)(?=")/gi;
const RM_QUOTE_RE = /"[^"]+"\s{0,}/g;

/** The lowercased text of a mock, as searching needs to see it. */
interface IOhMySearchableMock {
  response: string;
  headers: string;
  label: string;
  statusCode: string;
}

/**
 * Lowercased projections of mocks, keyed by the mock itself.
 *
 * The searchable text used to be produced by overwriting the mock in place —
 * `mock.responseMock = mock.responseMock.toLowerCase()`, `mock.headers =
 * JSON.stringify(mock.headers)` — on the very objects the background script
 * then persists, so filtering could lowercase a stored response body and
 * replace a headers object with a string. The guard that was meant to make it
 * happen at most once was itself misspelled (`responseRreadyForSearch` vs
 * `responseReadyForSearch`), so it fired for every search word.
 *
 * Deriving a separate value keeps the mock untouched; the WeakMap keeps the
 * cache from holding mocks alive.
 */
const searchableMocks = new WeakMap<IMock, IOhMySearchableMock>();

function toSearchable(mock: IMock): IOhMySearchableMock {
  let searchable = searchableMocks.get(mock);

  if (!searchable) {
    searchable = {
      // `responseMock`/`headers` are declared as `string` and
      // `Record<string, string>`, but data written by older versions can hold
      // the other shape, which is why both are handled through `unknown`.
      response: stringifyForSearch(mock.responseMock),
      headers: stringifyForSearch(mock.headers),
      label: (mock.label ?? '').toLowerCase(),
      // Declared as a number, but `MockUtils.init` seeds it with `null` — the
      // status code search used to be wrapped in a `try/catch` for exactly that
      // reason.
      statusCode: stringifyForSearch(mock.statusCode)
    };

    searchableMocks.set(mock, searchable);
  }

  return searchable;
}

function stringifyForSearch(input: unknown): string {
  if (input === undefined || input === null) {
    return '';
  }

  return (typeof input === 'string' ? input : JSON.stringify(input)).toLowerCase();
}

export function splitIntoSearchTerms(input = ''): string[] {
  const qwords = (input.match(QUOTE_RE) || []);
  const words = input.replace(RM_QUOTE_RE, '').split(' ')
    .map(s => s.replace(/("")+/g, '').trim())
    .filter(w => w !== '"');

  return [...qwords, ...words].filter(t => !!t).map(w => w.toLowerCase());
}

export function shallowSearch(data: Record<string, IData>, words: string[], includes: Record<string, boolean>): Record<string, IData> {
  return Object.fromEntries<IData>(
    Object.entries(data).filter(kv =>
      words.some(v => {
        const value = kv[1];
        return value.url.toLowerCase().includes(v) && includes['url'] ||
          value.requestType?.toLowerCase().includes(v) && includes['requestType'] ||
          value.method?.toLowerCase().includes(v) && includes['requestMethod']
      })
    )
  );
}

export async function deepSearch(data: Record<string, IData>, words: string[], includes: Record<string, boolean>, mocks: Record<string, IMock> = {}): Promise<IData[]> {
  const out: IData[] = [];
  const values = Object.values(data);

  if (Object.keys(mocks).length === 0) {
    return [];
  }

  dataLoop:
  for (let i = 0; i < values.length; i++) {
    const dataMocks = Object.keys(values[i].mocks);

    for (let j = 0; j < dataMocks.length; j++) {
      const mock = mocks[dataMocks[j]];

      if (!mock) {
        // eslint-disable-next-line no-console
        console.warn('WebWorker could not find mock with id ' + dataMocks[j]);
        continue;
      }

      const contentType = getMimeType(mock.headersMock ?? {});
      const searchable = toSearchable(mock);

      try {
        if (words.some(w => {
          // The response body of an image is base64 noise; searching it only
          // produces false positives.
          if (!isImage(contentType) && includes.response && searchable.response.includes(w)) {
            return true;
          }

          if (includes.headers && searchable.headers.includes(w)) {
            return true;
          }

          if (includes.label && searchable.label.includes(w)) {
            return true;
          }

          return !!includes.statusCode && searchable.statusCode.includes(w);
        })) {
          out.push(values[i]);
          continue dataLoop;
        }
        // eslint-disable-next-line no-console
      } catch (err) { console.error('Ooops, something went wrong while searching. Please fill in a bug report!!', err) }
    }
  }

  return out;
}

export function transformFilterOptions(options: Record<string, boolean> = {}): Record<string, boolean> {
  return Object.entries(options).reduce((acc: Record<string, boolean>, [k, v]) => {
    const option = FILTER_SEARCH_OPTIONS.find(fo => fo.id === k);

    if (option) {
      acc[option.value] = v;
    }

    return acc;
  }, {});
}
