import { Routes } from '@angular/router';
import { forwarderGuard } from './forward-guard';
import { HomeComponent } from './pages/home/home.component';
import { ConfigComponent } from './components/config/config.component';

import { MockComponent } from './pages/mock/mock.component';
import { NgApiMockExportComponent } from './pages/exports/ng-api-mock-export/ng-api-mock-export.component';
import { StateExplorerComponent } from './pages/state-explorer/state-explorer.component';
import { NgApimockSettingsComponent } from './plugins/ngapimock/ng-apimock-settings/ng-apimock-settings.component';

const appRoutes: Routes = [
  {
    path: '',
    canActivate: [forwarderGuard],
    children: [
      {
        path: '',
        component: HomeComponent
      },
      {
        path: 'configure',
        component: ConfigComponent
      },
      {
        path: 'mocks/:index',
        component: MockComponent
      },
      {
        path: 'state-explore',
        component: StateExplorerComponent
      },
      {
        path: 'settings/ngapimock',
        component: NgApimockSettingsComponent
      }
    ]
  }
];

export { appRoutes };
