import { Routes } from '@angular/router';

import { PageCookiesComponent } from './cookies.component';

/**
 * The Cookies tab.
 *
 * Lazy, because the popup opens on the Requests tab and this has no reason to be
 * in the first chunk. A plain `Routes` array rather than an `NgModule`: the page
 * is standalone and brings its own imports, so the module had nothing left to
 * declare — it existed only to hold this array and to pull in `ComponentsModule`.
 */
export const routes: Routes = [
  {
    path: '',
    component: PageCookiesComponent
  }
];
