import { Routes } from '@angular/router';
import { forwarderGuard } from './forward-guard';
import { HomeComponent } from './pages/home/home.component';
import { ConfigComponent } from './components/config/config.component';

import { MockComponent } from './pages/mock/mock.component';
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
