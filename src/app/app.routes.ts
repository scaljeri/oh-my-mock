import { Routes } from '@angular/router';
import { ConfigComponent } from './components/config/config.component';

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
        path: 'configure',
        component: ConfigComponent
      },
      {
        path: 'state-explore',
        loadChildren: () => import('./pages/state-explorer/state-explorer.module').then(m => m.StateExplorerModule)
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
