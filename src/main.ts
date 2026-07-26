import { enableProdMode } from '@angular/core';
import { platformBrowser } from '@angular/platform-browser';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

// // For local serving only (with `ng serve`)
// declare let chrome: any;
// if (!chrome) {
//   window['chrome'] = {
//     storage: { local: { get: () => {}, set: () => {} } },
//     runtime: {
//       onMessage: { addListener: () => {} },
//       sendMessage: () => {},
//     },
//   } as any;
// }

if (environment.production) {
  enableProdMode();
}

platformBrowser()
  .bootstrapModule(AppModule)
  // eslint-disable-next-line no-console
  .catch((err) => console.error(err));
