import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { ConfigComponent } from './config/config.component';
import { RouterModule, Routes } from '@angular/router';
import { UrlsOverviewComponent } from './urls-overview/urls-overview.component';
import { MatIconModule } from '@angular/material/icon';
import { PipesModule } from '../pipes/pipes.module';

const routes: Routes = [{
  path: '', component: UrlsOverviewComponent
}, {
  path: 'configure', component: ConfigComponent
}]

@NgModule({
  declarations: [ConfigComponent, UrlsOverviewComponent],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    MatTableModule,
    MatIconModule,
    PipesModule
  ],
})
export class ComponentsModule { }
