import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule, Routes } from '@angular/router';

import { ComponentsModule } from '../../components/components.module';
import { PageCookiesComponent } from './cookies.component';

const routes: Routes = [
  {
    path: '',
    component: PageCookiesComponent
  }
];

/**
 * The Cookies tab.
 *
 * Lazy, like the state explorer, because the pages declared eagerly live in
 * `app.module.ts` and this one has no reason to be in the first chunk: the
 * popup opens on the Requests tab.
 */
@NgModule({
  declarations: [PageCookiesComponent],
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    ComponentsModule,
    RouterModule.forChild(routes)
  ],
  exports: [PageCookiesComponent]
})
export class CookiesModule { }
