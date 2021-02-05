import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { ConfigComponent } from './config/config.component';
import { UrlsOverviewComponent } from './urls-overview/urls-overview.component';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MockComponent } from './mock/mock.component';
import { PipesModule } from '../pipes/pipes.module';
import { RouterModule } from '@angular/router';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDialogModule } from '@angular/material/dialog';
import { HotToastModule } from '@ngneat/hot-toast';

import { MockTestComponent } from './mock-test/mock-test.component';


@NgModule({
  declarations: [ConfigComponent, UrlsOverviewComponent, MockComponent, MockTestComponent],
  imports: [
    CommonModule,
    MatTableModule,
    MatIconModule,
    PipesModule,
    RouterModule,
    MatFormFieldModule,
    MatCardModule,
    MatInputModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatExpansionModule,
    MatDialogModule,
    HotToastModule
  ],
  exports: [UrlsOverviewComponent, MockComponent, ConfigComponent]
})
export class ComponentsModule { }
