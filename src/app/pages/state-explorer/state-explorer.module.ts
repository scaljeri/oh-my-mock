import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';

import { StateExplorerComponent } from './state-explorer.component';
import { RouterModule, Routes } from '@angular/router';
import { DataOverviewComponent } from '../data-overview/data-overview.component';
import { PageMockComponent } from '../mock/mock.component';

const routes: Routes = [
  {
    path: '',
    component: StateExplorerComponent,
    children: [
      {
        path: ':domain',
        component: DataOverviewComponent
      },
      {
        path: ':domain/mocks/:mockIndex',
        component: PageMockComponent
      }
    ]
  }
];

@NgModule({
  declarations: [StateExplorerComponent],
  imports: [
    CommonModule,
    MatCardModule,
    MatExpansionModule,
    RouterModule.forChild(routes)
  ],
  exports: [StateExplorerComponent]
})
export class StateExplorerModule {}
