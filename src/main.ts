import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

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

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch((err) => console.error(err));
