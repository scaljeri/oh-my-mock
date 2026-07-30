import { Routes } from '@angular/router';

import { PageStateExplorerComponent } from './state-explorer.component';
import { PageMockComponent } from '../mock/mock.component';
import { PageDataListComponent } from '../data-list/data-list.component';

/**
 * The state explorer: every domain the extension knows, with its requests.
 *
 * Lazy, and a plain `Routes` array rather than an `NgModule` — all three
 * components are standalone and bring their own imports, so the module held
 * nothing but this array and an import of `ComponentsModule`.
 */
export const routes: Routes = [
  {
    path: '',
    component: PageStateExplorerComponent,
    children: [
      {
        path: ':domain',
        component: PageDataListComponent,
        data: { theme: 'light' }
      },
      {
        path: ':domain/mocks/:mockIndex',
        component: PageMockComponent
      }
    ]
  }
];
