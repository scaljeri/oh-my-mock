/**
 * Express app factory for the OhMyMock test site.
 *
 * Kept free of `listen()` so tests can mount it on an ephemeral port, and free
 * of the websocket SDK so a plain mocking test never has a socket.io client
 * attached to it. The SDK server is a separate, opt-in process — see
 * `test-site/server/sdk-server.ts`.
 */

import express, { type Express } from 'express';
import * as path from 'node:path';
import { createHitCounter, type HitCounter, registerPages, registerRoutes } from './routes.mts';

export interface TestSiteApp {
  app: Express;
  hits: HitCounter;
}

export interface CreateAppOptions {
  /** Adds permissive CORS headers. Used by the alternate-origin instance. */
  cors?: boolean;
  /** Absolute path to the static site. Defaults to `test-site/public`. */
  publicDir?: string;
}

export function createApp(options: CreateAppOptions = {}): TestSiteApp {
  const publicDir =
    options.publicDir ?? path.join(import.meta.dirname, '..', 'public');

  const app = express();
  const hits = createHitCounter();

  // Responses must never be cached: a cached 200 would make a "did the server
  // get hit?" assertion meaningless.
  app.use((_req, res, next) => {
    res.setHeader('cache-control', 'no-store, no-cache, must-revalidate');
    res.setHeader('pragma', 'no-cache');
    next();
  });

  if (options.cors) {
    app.use((req, res, next) => {
      res.setHeader('access-control-allow-origin', '*');
      res.setHeader('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('access-control-allow-headers', '*');
      if (req.method === 'OPTIONS') {
        res.sendStatus(204);
        return;
      }
      next();
    });
  }

  // Parsed before the routes so `/api/echo` can report the body. `text/*` is
  // included so a non-JSON POST body survives the round trip too.
  app.use(express.json({ limit: '10mb' }));
  app.use(express.text({ type: 'text/*', limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  registerRoutes(app, hits);
  registerPages(app, publicDir);

  return { app, hits };
}
