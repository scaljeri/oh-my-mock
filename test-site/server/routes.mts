/**
 * The test API.
 *
 * Every endpoint exists to exercise one specific thing OhMyMock has to deal
 * with: a content type, a status code, a delay, a header, a redirect. Keep them
 * boring and orthogonal — one endpoint should test one property.
 *
 * Requests to `/api/*` are counted (see `createHitCounter`). Tests use those
 * counts to prove the negative: when a response is mocked, the server must not
 * have been reached at all.
 */

import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import express, { type Express, type Request, type Response } from 'express';
import {
  binaryFixture,
  gifFixture,
  htmlFixture,
  jsonFixture,
  largeFixture,
  pngFixture,
  SERVER_MARKER,
  svgFixture,
  textFixture,
  usersFixture,
  cookieFixtures,
  PERSISTENT_COOKIE_MAX_AGE_MS
} from './fixtures.mts';

/**
 * The `cookie` request header, in the order the client sent it.
 *
 * A list, not a map: the same name may legitimately appear twice, once per
 * path — `ohMySession` on `/` and on `/api/admin` is exactly the case the
 * fixtures set up, and a map silently drops one of them. That is the same
 * mistake the cookie-jar unit harness made, where it hid a real bug.
 *
 * Hand-rolled rather than pulling in `cookie-parser`: the test site has no
 * build step and as few dependencies as it can get away with. Values are
 * percent-decoded because `res.cookie` encodes them on the way out.
 */
function parseCookieHeader(header: string | undefined): { name: string; value: string }[] {
  const out: { name: string; value: string }[] = [];

  for (const pair of (header ?? '').split(';')) {
    const eq = pair.indexOf('=');

    if (eq < 1) {
      continue; // no name, or no `=` at all
    }

    const raw = pair.slice(eq + 1).trim();
    let value = raw;

    try {
      value = decodeURIComponent(raw);
    } catch {
      // A malformed escape must not take the whole response down.
    }

    out.push({ name: pair.slice(0, eq).trim(), value });
  }

  return out;
}

/**
 * The first value sent for a name.
 *
 * RFC 6265 has a client send the longer path first, so for a name that exists
 * on both `/` and `/api/admin` this is the sub-path one — the value that
 * endpoint is actually scoped to. Read the list itself when both matter.
 */
function firstCookie(
  cookies: { name: string; value: string }[], name: string
): string | null {
  return cookies.find(c => c.name === name)?.value ?? null;
}

export interface HitCounter {
  record(req: Request): void;
  snapshot(): Record<string, number>;
  reset(label?: string): void;
  journal(): JournalEntry[];
}

/**
 * One line of the hit journal: a request, or a reset.
 *
 * The counts alone say how many; when that number is wrong they say nothing at
 * all about whose request it was. The journal survives the resets and records
 * the test each one was made for, so an unexpected hit can be placed: this
 * page, the page before it, or — while the site still listened on one fixed
 * port and two runs shared it — somebody else's suite entirely. That last one
 * is what it was, and how `onload.spec.ts` came to count two hits for a request
 * its page had made once. Keep it: a wrong count is the one failure this
 * harness cannot explain on its own.
 */
export interface JournalEntry {
  kind: 'hit' | 'reset';
  /** Milliseconds since the server started — monotonic, unlike a wall clock. */
  atMs: number;
  /** Which reset generation this line falls in. */
  epoch: number;
  key?: string;
  referer?: string;
  userAgent?: string;
  /** The test the reset was made for, as the fixture reported it. */
  label?: string;
}

/** Enough to see a whole suite run without unbounded growth. */
const JOURNAL_LIMIT = 5_000;

export function createHitCounter(): HitCounter {
  let hits: Record<string, number> = {};
  let epoch = 0;
  const log: JournalEntry[] = [];
  const startedAt = performance.now();

  function append(entry: Omit<JournalEntry, 'atMs' | 'epoch'>): void {
    log.push({
      ...entry,
      atMs: Math.round(performance.now() - startedAt),
      epoch
    });

    if (log.length > JOURNAL_LIMIT) {
      log.shift();
    }
  }

  return {
    record(req) {
      // `originalUrl` rather than `path`: the counter is mounted with
      // `app.use('/api', ...)`, which strips the mount point from `req.path`
      // and would record `/json` instead of `/api/json`.
      //
      // Query strings are dropped: `/api/json?x=1` and `/api/json` are the same
      // endpoint for counting purposes, which is what assertions care about.
      const key = `${req.method} ${req.originalUrl.split('?')[0]}`;
      hits[key] = (hits[key] ?? 0) + 1;
      append({
        kind: 'hit',
        key,
        referer: req.get('referer') ?? undefined,
        userAgent: req.get('user-agent') ?? undefined
      });
    },
    snapshot() {
      return { ...hits };
    },
    reset(label) {
      hits = {};
      epoch += 1;
      append({ kind: 'reset', label });
    },
    journal() {
      return [...log];
    }
  };
}

/** Marks every API response so its origin is unambiguous in assertions. */
function markServer(res: Response): void {
  res.setHeader('x-oh-my-source', SERVER_MARKER);
}

export function registerRoutes(app: Express, hits: HitCounter): void {
  // ---- harness control plane -------------------------------------------
  // Deliberately *not* under /api, so it is never counted and never mocked.

  app.get('/_harness/stats', (_req, res) => {
    res.json({ hits: hits.snapshot() });
  });

  app.post('/_harness/reset', (req, res) => {
    const label = (req.body as { label?: string } | undefined)?.label;
    hits.reset(typeof label === 'string' ? label : undefined);
    res.json({ ok: true });
  });

  // Who hit what, across resets — see `JournalEntry`.
  app.get('/_harness/journal', (_req, res) => {
    res.json({ journal: hits.journal() });
  });

  app.get('/_harness/health', (_req, res) => {
    res.json({ ok: true });
  });

  // ---- counting ---------------------------------------------------------

  app.use('/api', (req, _res, next) => {
    hits.record(req);
    next();
  });

  // ---- content types ----------------------------------------------------

  app.get('/api/json', (_req, res) => {
    markServer(res);
    res.json(jsonFixture);
  });

  app.get('/api/users', (_req, res) => {
    markServer(res);
    res.json(usersFixture);
  });

  app.get('/api/text', (_req, res) => {
    markServer(res);
    res.type('text/plain').send(textFixture);
  });

  app.get('/api/html', (_req, res) => {
    markServer(res);
    res.type('text/html').send(htmlFixture);
  });

  app.get('/api/image.png', (_req, res) => {
    markServer(res);
    res.type('image/png').send(pngFixture);
  });

  app.get('/api/image.gif', (_req, res) => {
    markServer(res);
    res.type('image/gif').send(gifFixture);
  });

  app.get('/api/image.svg', (_req, res) => {
    markServer(res);
    res.type('image/svg+xml').send(svgFixture);
  });

  app.get('/api/binary', (_req, res) => {
    markServer(res);
    res.type('application/octet-stream').send(binaryFixture);
  });

  // ---- size -------------------------------------------------------------

  app.get('/api/large', (req, res) => {
    const sizeKb = Math.min(Number(req.query.kb ?? 512), 8192);
    markServer(res);
    res.type('text/plain').send(largeFixture(sizeKb));
  });

  // ---- methods & bodies -------------------------------------------------

  // Echoes the request back. Lets tests assert on what the extension forwarded
  // (method, headers, body) and lets mock jsCode read `request.body`.
  app.all('/api/echo', (req, res) => {
    markServer(res);
    res.json({
      source: SERVER_MARKER,
      method: req.method,
      path: req.path,
      query: req.query,
      headers: req.headers,
      body: req.body ?? null
    });
  });

  // ---- status codes -----------------------------------------------------

  app.get('/api/status/:code', (req, res) => {
    const code = Number(req.params.code);
    markServer(res);

    if (!Number.isInteger(code) || code < 100 || code > 599) {
      res.status(400).json({ error: 'invalid status code' });
      return;
    }

    // 204/304 must not carry a body, or Node will reject the write.
    if (code === 204 || code === 304) {
      res.status(code).end();
      return;
    }

    res.status(code).json({ source: SERVER_MARKER, statusCode: code });
  });

  // ---- timing -----------------------------------------------------------

  app.get('/api/delay/:ms', (req, res) => {
    const ms = Math.min(Number(req.params.ms) || 0, 30_000);
    setTimeout(() => {
      markServer(res);
      res.json({ source: SERVER_MARKER, delayedMs: ms });
    }, ms);
  });

  // ---- headers ----------------------------------------------------------

  app.get('/api/headers', (_req, res) => {
    markServer(res);
    res.setHeader('x-oh-my-custom', 'original-value');
    res.setHeader('x-oh-my-number', '42');
    // Exposed so cross-origin reads can see them too.
    res.setHeader(
      'access-control-expose-headers',
      'x-oh-my-source, x-oh-my-custom, x-oh-my-number'
    );
    res.json({ source: SERVER_MARKER });
  });

  // ---- redirects --------------------------------------------------------

  app.get('/api/redirect', (_req, res) => {
    res.redirect(302, '/api/json');
  });

  app.get('/api/redirect-chain', (_req, res) => {
    res.redirect(302, '/api/redirect');
  });

  // ---- cookies ----------------------------------------------------------

  app.get('/api/cookie', (_req, res) => {
    markServer(res);
    // httpOnly so the page cannot read it — verifies the extension does not
    // need script access to cookies in order to mock the response.
    res.cookie('ohMyTest', 'cookie-value', { httpOnly: true, sameSite: 'lax' });
    res.json({ source: SERVER_MARKER });
  });

  // Hands out the whole fixture spread in one response, so a single passthrough
  // gives the recorder every flag combination to pick up.
  app.get('/api/cookies/set', (_req, res) => {
    markServer(res);

    for (const cookie of cookieFixtures) {
      res.cookie(cookie.name, cookie.value, {
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
        path: cookie.path,
        ...(cookie.persistent && { maxAge: PERSISTENT_COOKIE_MAX_AGE_MS })
      });
    }

    res.json({ source: SERVER_MARKER, set: cookieFixtures.map(c => c.name) });
  });

  // What the browser actually *sent*. `/api/echo` returns the raw header; this
  // parses it, which is what proves a mocked cookie reaches the server rather
  // than merely sitting in the jar. httpOnly cookies are included — the server
  // sees them even though the page cannot.
  app.get('/api/cookies', (req, res) => {
    markServer(res);
    res.json({
      source: SERVER_MARKER,
      cookies: parseCookieHeader(req.headers.cookie),
      raw: req.headers.cookie ?? ''
    });
  });

  // Expires every fixture cookie, so a test can get back to a known jar.
  app.get('/api/cookies/clear', (_req, res) => {
    markServer(res);

    for (const cookie of cookieFixtures) {
      res.clearCookie(cookie.name, { path: cookie.path });
    }

    res.json({ source: SERVER_MARKER, cleared: cookieFixtures.map(c => c.name) });
  });

  // A sub-path endpoint, so the path-scoped fixture can be requested from a url
  // the browser will actually send it to.
  app.get('/api/admin/whoami', (req, res) => {
    markServer(res);
    const cookies = parseCookieHeader(req.headers.cookie);

    res.json({
      source: SERVER_MARKER,
      // Both `ohMySession` cookies are sent here — `/` and `/api/admin` both
      // match — and the sub-path one comes first.
      session: firstCookie(cookies, 'ohMySession'),
      cookies,
      raw: req.headers.cookie ?? ''
    });
  });

  // ---- error path -------------------------------------------------------

  // Closes the socket without replying, to exercise network-failure handling.
  app.get('/api/abort', (req, res) => {
    req.socket.destroy();
    void res;
  });

  // ---- static site ------------------------------------------------------

  app.get('/api/*', (_req, res) => {
    res.status(404).json({ error: 'unknown api endpoint' });
  });
}

/**
 * The harness page as text, optionally rewritten for a CSP variant.
 *
 * `index.html` is static and served by `sendFile` everywhere else. Two of the
 * CSP variants cannot use it as-is: a nonce policy is only a nonce policy if
 * the page's own `<script>` tags carry the nonce (without it the page is just
 * "no script may run", which `/csp-script-none` already covers), and a
 * `<meta http-equiv>` policy has to be *in* the document. Both are one-line
 * splices, so they happen here rather than by keeping three near-copies of a
 * 140-line page in `public/`.
 *
 * Read per request, not cached: the site has no build step and is edited by
 * hand while tests run.
 */
function harnessHtml(
  publicDir: string,
  options: { nonce?: string; metaPolicy?: string } = {}
): string {
  let html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');

  if (options.metaPolicy) {
    // Immediately after `<head>`, because a `<meta>` policy governs only what
    // the parser reaches *after* it — put below the script tags it would not
    // apply to them at all and the page would prove nothing.
    html = html.replace(
      '<head>',
      `<head>\n  <meta http-equiv="Content-Security-Policy" content="${options.metaPolicy}">`
    );
  }

  if (options.nonce) {
    html = html.replaceAll('<script ', `<script nonce="${options.nonce}" `);
  }

  return html;
}

/** A fresh nonce per response, as a real nonce policy requires. */
function freshNonce(): string {
  return randomBytes(16).toString('base64');
}

/**
 * Serves the harness pages. Split from the API so that CSP variants can be
 * mounted per page without leaking into API responses.
 *
 * Everything under `/csp-*` exists for `tests/specs/csp.spec.ts`. OhMyMock puts
 * its page-context bundle in with a `world: 'MAIN'` content script, and the
 * claim these pages exist to test is that Chromium does not apply the page's
 * CSP to one. The variants are the directives that could plausibly interfere,
 * each isolated so a failure names the directive responsible.
 */
export function registerPages(app: Express, publicDir: string): void {
  // `script-src 'self'` — the ordinary strict policy, and the one that used to
  // defeat the old `<div onclick>` + `<script src>` injection. The page's own
  // scripts are same-origin, so the harness still loads here.
  app.get('/csp-strict', (_req, res) => {
    res.setHeader(
      'content-security-policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
    );
    res.sendFile('index.html', { root: publicDir });
  });

  // Same page, but CSP is report-only: injection must succeed untouched.
  app.get('/csp-report-only', (_req, res) => {
    res.setHeader(
      'content-security-policy-report-only',
      "default-src 'self'; script-src 'self'"
    );
    res.sendFile('index.html', { root: publicDir });
  });

  // `script-src 'none'` — the strongest form there is: not one script may run,
  // not even the page's own. `harness.js` and `ui.js` are blocked, so specs
  // using this page drive `window.fetch` through `page.evaluate` instead.
  app.get('/csp-script-none', (_req, res) => {
    res.setHeader('content-security-policy', "script-src 'none'");
    res.sendFile('index.html', { root: publicDir });
  });

  // `default-src 'none'` with no `script-src` at all — scripts fall back to
  // `default-src`. A separate case from the one above because it is a separate
  // code path in a CSP implementation, and because a policy written this way
  // also blocks the stylesheet, the favicon and every fetch.
  app.get('/csp-default-none', (_req, res) => {
    res.setHeader('content-security-policy', "default-src 'none'");
    res.sendFile('index.html', { root: publicDir });
  });

  // A nonce policy: only scripts carrying this response's nonce may run. It is
  // the modern replacement for `script-src 'self'` and it is stricter — a
  // same-origin script without the nonce is refused.
  app.get('/csp-nonce', (_req, res) => {
    const nonce = freshNonce();

    res.setHeader(
      'content-security-policy',
      `default-src 'self'; script-src 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'`
    );
    res.type('html').send(harnessHtml(publicDir, { nonce }));
  });

  // `'strict-dynamic'`: the nonce-bearing scripts may load further scripts, and
  // every host-source and `'self'` in the policy is *discarded*. Worth its own
  // page because it is the one policy under which "the script is same-origin"
  // stops being an argument for letting it run.
  app.get('/csp-strict-dynamic', (_req, res) => {
    const nonce = freshNonce();

    res.setHeader(
      'content-security-policy',
      `default-src 'self'; script-src 'nonce-${nonce}' 'strict-dynamic'; ` +
        "style-src 'self' 'unsafe-inline'"
    );
    res.type('html').send(harnessHtml(publicDir, { nonce }));
  });

  // The same strict policy, delivered by `<meta http-equiv>` rather than a
  // header. A different code path in Chromium — the policy only exists from the
  // moment the parser reaches the tag — and therefore a different question.
  app.get('/csp-meta', (_req, res) => {
    res.type('html').send(
      harnessHtml(publicDir, {
        metaPolicy: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
      })
    );
  });

  // `sandbox allow-scripts`: the document keeps its scripting but loses its
  // origin — `window.location.origin` reads `"null"`. That is the case
  // `targetOrigin()` in `src/injected/message/send.ts` falls back to `'*'` for,
  // so this page is what says that fallback works.
  app.get('/csp-sandbox', (_req, res) => {
    res.setHeader('content-security-policy', 'sandbox allow-scripts');
    res.sendFile('index.html', { root: publicDir });
  });

  // `sandbox` with no `allow-scripts`: scripting is off for the whole document.
  app.get('/csp-sandbox-no-scripts', (_req, res) => {
    res.setHeader('content-security-policy', 'sandbox');
    res.sendFile('index.html', { root: publicDir });
  });

  // `connect-src 'none'`: scripts run, but no script may open a connection.
  // The interesting one, because OhMyMock's passthrough calls the page's own
  // `fetch` — so the page's `connect-src` governs it exactly as it governs the
  // page. Scripts are left alone so the harness loads and the comparison is
  // against a page that works in every other respect.
  app.get('/csp-connect-none', (_req, res) => {
    res.setHeader(
      'content-security-policy',
      "default-src 'self'; connect-src 'none'; style-src 'self' 'unsafe-inline'"
    );
    res.sendFile('index.html', { root: publicDir });
  });

  app.use(express.static(publicDir, { etag: false, lastModified: false }));
}
