import type { SearchWorkerFactory } from './search-worker.token';

/**
 * The real worker factory. See `search-worker.token.ts` for why this is a
 * separate file: `import.meta` lives here and nowhere else, so unit tests never
 * pull it into their module graph.
 *
 * Only `app.module.ts` should import this.
 */
export const createSearchWorker: SearchWorkerFactory = () =>
  new Worker(new URL('../webworkers/search.worker', import.meta.url), {
    type: 'module'
  });
