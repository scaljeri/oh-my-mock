import { InjectionToken } from '@angular/core';

/**
 * Creates the search web worker.
 *
 * Deliberately split from the implementation in `search-worker.factory.ts`.
 * That file calls `new Worker(new URL(..., import.meta.url))` — the standard
 * Angular idiom, and the one the bundler needs in order to emit the worker —
 * but `import.meta` cannot be compiled to CommonJS, and Jest runs the specs as
 * CommonJS (see `jest.config.js`).
 *
 * Keeping only the token here means `WebWorkerService` and everything that
 * imports it stay free of `import.meta`; the factory is pulled in solely by
 * `app.module.ts`, which no spec loads. Specs provide their own stub.
 */
export type SearchWorkerFactory = () => Worker;

export const OH_MY_SEARCH_WORKER_FACTORY =
  new InjectionToken<SearchWorkerFactory>('OhMySearchWorkerFactory');
