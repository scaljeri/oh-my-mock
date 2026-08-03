import { Routes } from '@angular/router';

import { PageMockComponent } from './pages/mock/mock.component';
import { PageDataListComponent } from './pages/data-list/data-list.component';
import { JsonExportComponent } from './pages/json-export/json-export.component';

const appRoutes: Routes = [
  {
    path: '',
    children: [
      {
        // The request detail is a *child* of the list, not a sibling: the
        // design shows them side by side, so selecting a request must not
        // navigate away from the list it was selected in.
        path: '',
        component: PageDataListComponent,
        children: [
          {
            path: 'request/:dataId',
            component: PageMockComponent
          }
        ]
      },
      {
        // The second tab next to the request list. A route rather than a local
        // switch, so the tab survives a reload of the popup.
        path: 'cookies',
        loadChildren: () => import('./pages/cookies/cookies.routes').then(m => m.routes)
      },
      {
        path: 'state-explore',
        loadChildren: () => import('./pages/state-explorer/state-explorer.routes').then(m => m.routes)
      },
      {
        path: 'json-export',
        component: JsonExportComponent
      },
      {
        // Managing the domains OhMyMock knows about. A page rather than part of
        // the sidebar: which domain is on screen follows the active tab, so
        // there is nothing to pick — what is left is housekeeping.
        path: 'domains',
        loadComponent: () =>
          import('./pages/domains/domains.component').then(
            (m) => m.DomainsComponent
          )
      },
      {
        // Both remote sources — the local SDK server and, later, the cloud —
        // under one page: they answer the same question.
        path: 'remote-mocking',
        loadComponent: () =>
          import('./pages/remote-mocking/remote-mocking.component').then(
            (m) => m.RemoteMockingComponent
          )
      }
    ]
  }
];

export { appRoutes };
