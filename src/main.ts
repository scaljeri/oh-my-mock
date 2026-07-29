import { enableProdMode, importProvidersFrom } from '@angular/core';
import { BrowserModule, bootstrapApplication } from '@angular/platform-browser';

import { environment } from './environments/environment';
import { provideHotToastConfig } from '@ngxpert/hot-toast';
import { OH_MY_SEARCH_WORKER_FACTORY } from './app/services/search-worker.token';
import { createSearchWorker } from './app/services/search-worker.factory';
import { provideMonacoEditor } from 'ngx-monaco-editor-v2';
import {
  MONACO_BASE_URL,
  installMonacoEnvironment
} from './app/components/form/code-edit/monaco-environment';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import {
  withHashLocation,
  withInMemoryScrolling,
  provideRouter
} from '@angular/router';
import { appRoutes } from './app/app.routes';
import { HttpClientModule } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatBadgeModule } from '@angular/material/badge';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { ComponentsModule } from './app/components/components.module';
import { AppComponent } from './app/app.component';

// Served from `localhost:4200` there is no extension around the popup, so
// `chrome.*` is absent and the app used to die on the first `getManifest()`.
// The shim is a no-op the moment a real `chrome.runtime` exists, so this is
// safe in the shipped bundle — see `dev-chrome-shim.ts` for what it does and
// does not give you.

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(
      BrowserModule,
      BrowserAnimationsModule,
      HttpClientModule,
      ReactiveFormsModule,
      MatToolbarModule,
      MatIconModule,
      MatButtonModule,
      MatSlideToggleModule,
      MatSidenavModule,
      MatCheckboxModule,
      MatFormFieldModule,
      MatInputModule,
      MatBadgeModule,
      MatSnackBarModule,
      ComponentsModule
    ),
    provideHotToastConfig(),
    { provide: OH_MY_SEARCH_WORKER_FACTORY, useValue: createSearchWorker },
    // Without a `baseUrl` the loader looks for `assets/monaco/min/vs`, but
    // `angular.json` copies Monaco to `assets/monaco-editor/min/vs`. The
    // mismatch 404s `loader.js` and every code editor in the app then renders
    // as an empty box — silently, because `CodeEditComponent` polls for
    // `window.monaco` forever rather than failing.
    //
    // `onMonacoLoad` runs the moment the AMD bundle is in: it swaps Monaco's
    // blob-based worker factory for one Chrome will actually run inside an
    // extension. Without it the language workers never start and the editors
    // have no validation — see `monaco-environment.ts`.
    provideMonacoEditor({
      baseUrl: MONACO_BASE_URL,
      onMonacoLoad: installMonacoEnvironment
    }),
    { provide: Window, useValue: window },
    provideRouter(
      appRoutes,
      withHashLocation(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })
    )
  ]
})
  // eslint-disable-next-line no-console
  .catch((err) => console.error(err));
