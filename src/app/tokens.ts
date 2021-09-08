import { InjectionToken } from '@angular/core';

const manifest = chrome.runtime.getManifest()

export const APP_VERSION = new InjectionToken<string>('App version', {
  providedIn: 'root',
  factory: () => manifest.version
});
