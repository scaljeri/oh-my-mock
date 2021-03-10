import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { RouterModule, Routes } from '@angular/router';
import { NgxsModule } from '@ngxs/store'
import { NgxsDispatchPluginModule } from "@ngxs-labs/dispatch-decorator";

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSidenavModule } from '@angular/material/sidenav';

import { ComponentsModule } from './components/components.module';
import { OhMyState } from './store/state';
import { HomeComponent } from './pages/home/home.component';
import { HotToastModule } from '@ngneat/hot-toast';

import { MockModule } from './pages/mock/mock.module';
import { NgApiMockExportComponent } from './pages/exports/ng-api-mock-export/ng-api-mock-export.component';
import { StateExplorerModule } from './pages/state-explorer/state-explorer.module';
import { appRoutes } from './app.routes';
import { ContentService } from './services/content.service';

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    NgApiMockExportComponent,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    RouterModule.forRoot(appRoutes, { useHash: true }),
    NgxsModule.forRoot([OhMyState], { developmentMode: true }),
    NgxsDispatchPluginModule.forRoot(),
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatSidenavModule,
    HotToastModule.forRoot(),
    ComponentsModule,
    MockModule,
    StateExplorerModule,
  ],
  providers: [
    { provide: Window, useValue: window }],
  bootstrap: [AppComponent]
})
export class AppModule {
  constructor(contentService: ContentService) {}
 }
