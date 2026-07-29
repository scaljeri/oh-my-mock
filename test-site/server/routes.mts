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
  reset(): void;
}

export function createHitCounter(): HitCounter {
  let hits: Record<string, number> = {};

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
    },
    snapshot() {
      return { ...hits };
    },
    reset() {
      hits = {};
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

  app.post('/_harness/reset', (_req, res) => {
    hits.reset();
    res.json({ ok: true });
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
 * Serves the harness pages. Split from the API so that CSP variants can be
 * mounted per page without leaking into API responses.
 */
export function registerPages(app: Express, publicDir: string): void {
  // A page with a restrictive CSP. OhMyMock injects its script into the page
  // context, so this is the regression test for the CSP-removal fallback in
  // `src/content/inject-code.ts`.
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

  app.use(express.static(publicDir, { etag: false, lastModified: false }));
}
