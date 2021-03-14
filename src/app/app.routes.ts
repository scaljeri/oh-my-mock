import { Routes } from '@angular/router';
import { forwarderGuard } from './forward-guard';
import { DataOverviewComponent } from './pages/data-overview/data-overview.component';
import { ConfigComponent } from './components/config/config.component';

import { NgApimockSettingsComponent } from './plugins/ngapimock/ng-apimock-settings/ng-apimock-settings.component';
import { PageMockComponent } from './pages/mock/mock.component';

const appRoutes: Routes = [
  {
    path: '',
    canActivate: [forwarderGuard],
    children: [
      {
        path: '',
        component: DataOverviewComponent
      },
      {
        path: 'configure',
        component: ConfigComponent
      },
      {
        path: 'mocks/:mockIndex',
        component: PageMockComponent
      },
      {
        path: 'state-explore',
        loadChildren: () => import('./pages/state-explorer/state-explorer.module').then(m => m.StateExplorerModule)
      },
      {
        path: 'settings/ngapimock',
        component: NgApimockSettingsComponent
      }
    ]
  }
];

export { appRoutes };
