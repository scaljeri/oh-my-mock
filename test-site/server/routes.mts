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
  usersFixture
} from './fixtures.mts';

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
