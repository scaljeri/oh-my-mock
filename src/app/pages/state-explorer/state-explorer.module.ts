import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';

import { PageStateExplorerComponent } from './state-explorer.component';
import { RouterModule, Routes } from '@angular/router';
import { PageMockComponent } from '../mock/mock.component';
import { PageDataListComponent } from '../data-list/data-list.component';
import { ComponentsModule } from '../../components/components.module';
import { HotToastModule } from '@ngneat/hot-toast';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

const routes: Routes = [
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

@NgModule({
  declarations: [PageStateExplorerComponent],
  imports: [
    CommonModule,
    MatCardModule,
    MatExpansionModule,
    MatIconModule,
    MatButtonModule,
    RouterModule.forChild(routes),
    ComponentsModule,
    HotToastModule
  ],
  exports: [PageStateExplorerComponent]
})
export class StateExplorerModule { }
