import { Routes } from '@angular/router';
import { ConfigComponent } from './components/config/config.component';

import { NgApimockSettingsComponent } from './plugins/ngapimock/ng-apimock-settings/ng-apimock-settings.component';
import { PageMockComponent } from './pages/mock/mock.component';
import { PageDataListComponent } from './pages/data-list/data-list.component';
import { JsonExportComponent } from './pages/json-export/json-export.component';
import { CloudSyncPageComponent } from './pages/cloud-sync/cloud-sync-page.component';

const appRoutes: Routes = [
  {
    path: '',
    children: [
      {
        path: '',
        component: PageDataListComponent
      },
      {
        path: 'configure',
        component: ConfigComponent
      },
      {
        path: 'request/:dataId',
        component: PageMockComponent
      },
      {
        path: 'state-explore',
        loadChildren: () => import('./pages/state-explorer/state-explorer.module').then(m => m.StateExplorerModule)
      },
      {
        path: 'settings/ngapimock',
        component: NgApimockSettingsComponent
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
