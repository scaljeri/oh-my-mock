import { InjectionToken } from '@angular/core';

/**
 * The extension's version, from its own manifest.
 *
 * Read inside the factory rather than at module scope. `chrome.runtime` only
 * exists on an extension page, so the old module-level
 * `const manifest = chrome.runtime.getManifest()` threw the moment this file
 * was imported anywhere else — which is what broke `ng serve` outright: the
 * bundle failed before Angular could bootstrap, with three
 * `Cannot read properties of undefined (reading 'getManifest')` and a blank
 * page. A factory runs at injection time, and only for code that asks.
 */
export const APP_VERSION = new InjectionToken<string>('App version', {
  providedIn: 'root',
  factory: () => globalThis.chrome?.runtime?.getManifest().version ?? '0.0.0-dev'
});
