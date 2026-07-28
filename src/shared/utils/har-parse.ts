import { METHODS } from '../constants';
import { requestMethod, requestType } from '../types/request';
import { strip } from './mime-type';

/**
 * Reading a HAR file (HTTP Archive 1.2) into something this extension can mock.
 *
 * A HAR is what the DevTools Network panel exports, which makes it the fastest
 * route from "this bug happened" to "I can reproduce it offline". It is also
 * **untrusted input**: the file is written by another program, on another
 * machine, possibly by another tool entirely (Firefox, Charles, Insomnia).
 * Nothing below assumes a field is present, or is of the type the spec says it
 * is — every value is read through a guard and a file that fails one is
 * reported, never swallowed.
 *
 * Mapping the entries that survive onto `IData`/`IMock` is `har-import.ts`;
 * this module only reads and filters.
 */

// ---- what a HAR entry can become -------------------------------------------

/**
 * One HAR entry, normalised to the fields the extension needs.
 *
 * Deliberately flat and free of `unknown`: everything that could be missing has
 * already been decided on by the time an entry gets here.
 */
export interface IOhMyHarEntry {
  /** Index in `log.entries` — the only way back to the file. */
  index: number;
  method: requestMethod;
  /**
   * `XHR` or `FETCH`, taken from DevTools' `_resourceType`.
   *
   * It matters more than it looks: `StateUtils.findRequest` compares the stored
   * `requestType` with the intercepted one by equality, so a request stored as
   * `FETCH` is never matched by an `XMLHttpRequest`. When the file does not say
   * (only Chromium writes `_resourceType`), `FETCH` is assumed — see
   * `hasResourceTypes` on the parse result.
   */
  requestType: requestType;
  /** The absolute url as recorded, without its fragment. */
  url: string;
  /** `https://api.example.com` — the origin of `url`. */
  origin: string;
  /**
   * `api.example.com`, or `localhost:8090` — the host of `url`, **with** its
   * port.
   *
   * The port is part of it because that is what a domain is in this extension:
   * state is keyed by `window.location.host` (`OhMyContentState.host`), so
   * `localhost:8090` and `localhost:8091` are two domains. Using the bare
   * hostname here made the picker offer to import into `localhost`, a domain
   * whose mocks nothing would ever look up.
   */
  host: string;
  /** Path and query, which is what a request list is worth reading by. */
  path: string;
  statusCode: number;
  statusText?: string;
  /** The response's content type, without its parameters. May be `''`. */
  mimeType: string;
  /** Response headers, lower-cased and filtered — see `pickResponseHeaders`. */
  headers: Record<string, string>;
  /**
   * The response body.
   *
   * `undefined` means the HAR carried none: DevTools omits bodies it no longer
   * has (a reload without "preserve log", a body above the size limit). That is
   * not the same as an empty body, which is a legitimate answer for a 204, so
   * the two are kept apart and the import UI defaults such entries to
   * *unselected*.
   */
  body?: string;
  /** True when `body` is base64 and was left that way — a binary payload. */
  isBase64: boolean;
  /** `content.size` when the file gives one, else the length of the body. */
  size: number;
  startedDateTime?: string;
}

/** Why an entry did not survive. Shown to the user, grouped and counted. */
export enum harSkipReason {
  /** Not an object, no url, or a url that is not a url. */
  MALFORMED = 'malformed',
  /** `data:`, `blob:`, `ws:` … — nothing `fetch`/`XHR` mocking can key on. */
  SCHEME = 'scheme',
  /** An image, font, stylesheet, script, document or media load. */
  RESOURCE_TYPE = 'resource-type',
  /** A method outside `METHODS`, which a mock cannot be keyed by. */
  METHOD = 'method',
  /** The request never finished: status 0, or no response object at all. */
  NO_RESPONSE = 'no-response',
  /** 1xx, a redirect or a 304 — mocking one breaks the exchange it belongs to. */
  REDIRECT = 'redirect'
}

export const HAR_SKIP_LABELS: Record<harSkipReason, string> = {
  [harSkipReason.MALFORMED]: 'malformed entry',
  [harSkipReason.SCHEME]: 'not an http(s) request',
  [harSkipReason.RESOURCE_TYPE]: 'not an API call',
  [harSkipReason.METHOD]: 'unsupported method',
  [harSkipReason.NO_RESPONSE]: 'no response recorded',
  [harSkipReason.REDIRECT]: 'redirect or 304'
};

export interface IOhMyHarSkip {
  index: number;
  url: string;
  reason: harSkipReason;
}

export interface IOhMyHarParseSuccess {
  ok: true;
  /** The entries worth mocking, in file order. */
  entries: IOhMyHarEntry[];
  /** The ones that were left out, each with its reason. */
  skipped: IOhMyHarSkip[];
  /** How many entries the file held in total. */
  total: number;
  /** The host the session was recorded on, when the file names one. */
  pageHost?: string;
  /**
   * False when not one entry carried `_resourceType`, i.e. the file was not
   * written by Chromium. Everything kept is then assumed to be a `FETCH`.
   */
  hasResourceTypes: boolean;
  /** `log.version`, for the record. */
  version?: string;
}

export interface IOhMyHarParseFailure {
  ok: false;
  /** A sentence the UI can show as-is. Never empty. */
  error: string;
}

export type IOhMyHarParseResult = IOhMyHarParseSuccess | IOhMyHarParseFailure;

// ---- the filters, written out so they can be argued with --------------------

/**
 * The DevTools resource types that are worth importing.
 *
 * Everything else a page loads — images, fonts, stylesheets, scripts, the
 * document itself, media, websockets, preflights — is skipped, for two reasons.
 * It is noise (a HAR of one page load is hundreds of entries, nearly all of
 * them assets), and it is *unmockable* by construction: this extension patches
 * `fetch` and `XMLHttpRequest` in the page's world, so an `<img>`, `<script>`
 * or `<link>` load never reaches it at all. See
 * `docs/architecture/request-flow.md`, "What this design cannot see".
 */
const IMPORTABLE_RESOURCE_TYPES: Record<string, requestType> = {
  xhr: 'XHR',
  fetch: 'FETCH'
};

/**
 * The fallback for files without `_resourceType` (Firefox, Charles, …).
 *
 * Without the resource type there is no way to tell an API call from an asset
 * except by what came back, so anything that looks like an asset is dropped and
 * the rest is kept. Erring towards keeping is deliberate: an asset that slips
 * through is one unwanted row in a list the user picks from, while a dropped
 * API call is a mock they cannot get at all.
 */
const ASSET_MIME_RE = /^(image|font|audio|video)\/|^text\/(css|html)$|^application\/(javascript|x-javascript|font-\w+|vnd\.ms-fontobject)$|^text\/javascript$/;
const ASSET_EXTENSION_RE = /\.(js|mjs|css|map|html?|png|jpe?g|gif|svg|webp|avif|bmp|ico|cur|woff2?|ttf|otf|eot|mp[34]|m4[av]|webm|ogg|wav|pdf|zip)$/i;

/** Schemes an intercepted `fetch`/`XHR` can actually be keyed on. */
const HTTP_SCHEMES = ['http:', 'https:'];

/**
 * Response headers that must not be stored on a mock.
 *
 * `content-encoding`, `content-length` and `transfer-encoding` describe how the
 * body travelled over the wire; the body stored here has already been decoded,
 * so handing those to the page tells it to gunzip plain text or to expect a
 * length that is no longer true. The hop-by-hop headers describe a connection
 * that no longer exists. `set-cookie` is dropped because a mocked response is
 * fabricated inside the page and never reaches the cookie jar — cookies are
 * their own entity here, see `docs/architecture/cookie-mocking.md`.
 */
const DROPPED_RESPONSE_HEADERS = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
  'trailer',
  'upgrade',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'set-cookie'
]);

/** Content types whose base64 payload is worth decoding back into text. */
const TEXTUAL_MIME_RE = /^text\/|^application\/(json|xml|javascript|graphql|x-www-form-urlencoded|x-ndjson)$|\+(json|xml)$/;

// ---- guards -----------------------------------------------------------------

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function asString(input: unknown): string | undefined {
  return typeof input === 'string' ? input : undefined;
}

function asFiniteNumber(input: unknown): number | undefined {
  return typeof input === 'number' && Number.isFinite(input) ? input : undefined;
}

function isRequestMethod(method: string): method is requestMethod {
  return (METHODS as readonly string[]).includes(method);
}

// ---- parsing ----------------------------------------------------------------

/**
 * Reads the text of a `.har` file.
 *
 * The two ways a file can be wrong are reported apart, because they mean
 * different things to whoever picked it: "this is not JSON" (wrong file, or a
 * truncated download) and "this is JSON, but not a HAR" (an OhMyMock backup, an
 * OpenAPI document, …).
 */
export function parseHar(text: string): IOhMyHarParseResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text) as unknown;
  } catch (err) {
    return {
      ok: false,
      error: `Not valid JSON: ${err instanceof Error ? err.message : String(err)}`
    };
  }

  return parseHarLog(parsed);
}

/** The same, for a value that has already been through `JSON.parse`. */
export function parseHarLog(input: unknown): IOhMyHarParseResult {
  if (!isRecord(input)) {
    return { ok: false, error: 'Not a HAR file: the top level is not an object' };
  }

  const log = input['log'];

  if (!isRecord(log)) {
    return { ok: false, error: 'Not a HAR file: it has no `log` object' };
  }

  const rawEntries = log['entries'];

  if (!Array.isArray(rawEntries)) {
    return { ok: false, error: 'Not a HAR file: `log.entries` is missing or is not a list' };
  }

  const entries: IOhMyHarEntry[] = [];
  const skipped: IOhMyHarSkip[] = [];
  let hasResourceTypes = false;

  rawEntries.forEach((raw: unknown, index: number) => {
    if (isRecord(raw) && asString(raw['_resourceType']) !== undefined) {
      hasResourceTypes = true;
    }

    const result = readEntry(raw, index);

    if ('reason' in result) {
      skipped.push(result);
    } else {
      entries.push(result);
    }
  });

  return {
    ok: true,
    entries,
    skipped,
    total: rawEntries.length,
    hasResourceTypes,
    ...(readPageHost(log) && { pageHost: readPageHost(log) }),
    ...(asString(log['version']) && { version: asString(log['version']) })
  };
}

/**
 * The host the session was recorded on.
 *
 * It is the domain imported requests belong under: mocks are looked up by the
 * *page's* host (`OhMyContentState.host`), not by the host of the call, so a
 * page on `app.example.com` calling `api.example.com` stores that call under
 * `app.example.com`. Taken from the first `document` entry, falling back to
 * `log.pages[].title`, which DevTools fills with the page url.
 */
function readPageHost(log: Record<string, unknown>): string | undefined {
  const entries = log['entries'];

  if (Array.isArray(entries)) {
    for (const raw of entries) {
      if (!isRecord(raw) || asString(raw['_resourceType']) !== 'document') {
        continue;
      }

      const request = raw['request'];
      const host = isRecord(request) ? hostOf(asString(request['url'])) : undefined;

      if (host) {
        return host;
      }
    }
  }

  const pages = log['pages'];

  if (Array.isArray(pages)) {
    for (const page of pages) {
      const host = isRecord(page) ? hostOf(asString(page['title'])) : undefined;

      if (host) {
        return host;
      }
    }
  }

  return undefined;
}

function hostOf(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }

  try {
    const parsed = new URL(url);

    return HTTP_SCHEMES.includes(parsed.protocol) ? parsed.host : undefined;
  } catch {
    // A title that is not a url — DevTools writes the document url there, other
    // tools write the page's `<title>`. Not an error, just not a host.
    return undefined;
  }
}

function readEntry(raw: unknown, index: number): IOhMyHarEntry | IOhMyHarSkip {
  if (!isRecord(raw)) {
    return { index, url: '', reason: harSkipReason.MALFORMED };
  }

  const request = raw['request'];
  const rawUrl = isRecord(request) ? asString(request['url']) : undefined;

  if (!isRecord(request) || !rawUrl) {
    return { index, url: '', reason: harSkipReason.MALFORMED };
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    // A relative url is not valid in a HAR; nothing can be made of it, because
    // the origin it was relative to is not recorded either.
    return { index, url: rawUrl, reason: harSkipReason.MALFORMED };
  }

  if (!HTTP_SCHEMES.includes(parsedUrl.protocol)) {
    return { index, url: rawUrl, reason: harSkipReason.SCHEME };
  }

  // The fragment never reaches the server and is not part of what is matched.
  parsedUrl.hash = '';
  const url = parsedUrl.href;

  const response = raw['response'];
  const statusCode = isRecord(response) ? asFiniteNumber(response['status']) : undefined;
  const content = isRecord(response) && isRecord(response['content']) ? response['content'] : undefined;
  const mimeType = readMimeType(response, content);

  const resourceType = asString(raw['_resourceType']);
  const requestType = readRequestType(resourceType, mimeType, parsedUrl);

  if (!requestType) {
    return { index, url, reason: harSkipReason.RESOURCE_TYPE };
  }

  const method = (asString(request['method']) ?? '').toUpperCase();

  if (!isRequestMethod(method)) {
    return { index, url, reason: harSkipReason.METHOD };
  }

  // Status 0 is DevTools' way of saying the exchange never produced a response
  // — blocked, aborted, or failed DNS. There is nothing to mock with.
  if (!isRecord(response) || !statusCode) {
    return { index, url, reason: harSkipReason.NO_RESPONSE };
  }

  if (statusCode < 200 || (statusCode >= 300 && statusCode < 400)) {
    // A redirect is followed by the browser itself and appears in the file
    // alongside the response it led to; a 304 is answered from the cache the
    // page still holds. Mocking either one breaks the exchange rather than
    // reproducing it — the useful entry is the 200 next to it, which is kept.
    return { index, url, reason: harSkipReason.REDIRECT };
  }

  const { body, isBase64 } = readBody(content, mimeType);

  return {
    index,
    method,
    requestType,
    url,
    origin: parsedUrl.origin,
    host: parsedUrl.host,
    path: `${parsedUrl.pathname}${parsedUrl.search}`,
    statusCode,
    ...(asString(response['statusText']) && { statusText: asString(response['statusText']) }),
    mimeType,
    headers: pickResponseHeaders(response['headers']),
    ...(body !== undefined && { body }),
    isBase64,
    size: asFiniteNumber(content?.['size']) ?? body?.length ?? 0,
    ...(asString(raw['startedDateTime']) && { startedDateTime: asString(raw['startedDateTime']) })
  };
}

/**
 * The response's content type, preferring the header over `content.mimeType`.
 *
 * DevTools writes `x-unknown` into `content.mimeType` when it has nothing
 * better, so the header — when there is one — is the more truthful of the two.
 */
function readMimeType(response: unknown, content: Record<string, unknown> | undefined): string {
  const headers = isRecord(response) ? pickResponseHeaders(response['headers']) : {};
  const fromHeader = headers['content-type'];

  if (fromHeader) {
    return strip(fromHeader).trim().toLowerCase();
  }

  const declared = strip(asString(content?.['mimeType']) ?? '').trim().toLowerCase();

  return declared === 'x-unknown' ? '' : declared;
}

/**
 * `XHR` / `FETCH`, or `undefined` when the entry is not an API call at all.
 *
 * With a `_resourceType` the answer is exact. Without one it is a judgement
 * call on the content type and the file extension — see `ASSET_MIME_RE`.
 */
function readRequestType(
  resourceType: string | undefined, mimeType: string, url: URL
): requestType | undefined {
  if (resourceType !== undefined) {
    return IMPORTABLE_RESOURCE_TYPES[resourceType.toLowerCase()];
  }

  if (ASSET_MIME_RE.test(mimeType) || ASSET_EXTENSION_RE.test(url.pathname)) {
    return undefined;
  }

  return 'FETCH';
}

/**
 * Response headers as a lower-cased map.
 *
 * HAR stores them as a `{ name, value }` list, which may repeat a name. The
 * stored shape is a map, so repeats are joined with `, ` — the same thing the
 * `Headers` class does. HTTP/2 pseudo-headers (`:status`) are dropped: they are
 * not headers a response can carry.
 */
export function pickResponseHeaders(raw: unknown): Record<string, string> {
  const headers: Record<string, string> = {};

  if (!Array.isArray(raw)) {
    return headers;
  }

  for (const entry of raw) {
    if (!isRecord(entry)) {
      continue;
    }

    const name = asString(entry['name'])?.trim().toLowerCase();
    const value = asString(entry['value']);

    if (!name || value === undefined || name.startsWith(':') || DROPPED_RESPONSE_HEADERS.has(name)) {
      continue;
    }

    headers[name] = headers[name] === undefined ? value : `${headers[name]}, ${value}`;
  }

  return headers;
}

/**
 * The response body, decoded as far as it is useful to decode it.
 *
 * A HAR may hold the body base64-encoded (`content.encoding`). For a textual
 * type that encoding is in the way and is undone here. For a binary type it is
 * kept exactly as it is, because that is also how this extension stores binary
 * bodies itself — `persistResponse` runs them through `convertToB64` — so a
 * mocked image or download is served by the same code path either way.
 */
function readBody(
  content: Record<string, unknown> | undefined, mimeType: string
): { body?: string; isBase64: boolean } {
  const text = asString(content?.['text']);

  if (text === undefined) {
    return { isBase64: false };
  }

  if (asString(content?.['encoding'])?.toLowerCase() !== 'base64') {
    return { body: text, isBase64: false };
  }

  if (!TEXTUAL_MIME_RE.test(mimeType)) {
    return { body: text, isBase64: true };
  }

  const decoded = decodeBase64(text);

  // A body that claims to be base64 and is not stays as it was found: throwing
  // the entry away would lose a response over an encoding detail, and handing
  // the page a mangled body would be worse than handing it the raw text.
  return decoded === undefined ? { body: text, isBase64: true } : { body: decoded, isBase64: false };
}

/** UTF-8 aware base64 decode. `undefined` when the input is not base64. */
export function decodeBase64(input: string): string | undefined {
  try {
    const binary = atob(input);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));

    // `atob` yields one character per byte, so a multi-byte character would
    // come out mojibake without this step.
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return undefined;
  }
}
