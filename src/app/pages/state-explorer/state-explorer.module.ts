import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';

import { StateExplorerComponent } from './state-explorer.component';
import { RouterModule, Routes } from '@angular/router';
import { UrlsOverviewComponent } from 'src/app/components/urls-overview/urls-overview.component';

const routes: Routes = [
  {
    path: '',
    component: StateExplorerComponent,
    children: [
      {
        path: ':domain',
        component: UrlsOverviewComponent
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
