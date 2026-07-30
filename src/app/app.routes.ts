import { Routes } from '@angular/router';

import { PageMockComponent } from './pages/mock/mock.component';
import { PageDataListComponent } from './pages/data-list/data-list.component';
import { JsonExportComponent } from './pages/json-export/json-export.component';
import { CloudSyncPageComponent } from './pages/cloud-sync/cloud-sync-page.component';

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
        path: 'cloud-sync',
        component: CloudSyncPageComponent
      }
    ]
  }
];

export { appRoutes };
