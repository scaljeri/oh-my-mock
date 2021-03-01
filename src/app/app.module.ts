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
import { forwarderGuard } from './forward-guard';
import { OhMyState } from './store/state';
import { HomeComponent } from './pages/home/home.component';
import { UrlsOverviewComponent } from './components/urls-overview/urls-overview.component';
import { ConfigComponent } from './components/config/config.component';
import { MockComponent } from './components/mock/mock.component';
import { HotToastModule } from '@ngneat/hot-toast';

const routes: Routes = [
  {
    path: '',
    canActivate: [
      forwarderGuard
    ],
    children: [
      {
        path: '', component: UrlsOverviewComponent,
      },
      {
        path: 'configure', component: ConfigComponent
      }, {
        path: 'mocks/:index', component: MockComponent
      }
    ]
  }
];

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    RouterModule.forRoot(routes, { useHash: true }),
    NgxsModule.forRoot([OhMyState], { developmentMode: true }),
    NgxsDispatchPluginModule.forRoot(),
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatSidenavModule,
    HotToastModule.forRoot(),
    ComponentsModule
  ],
  providers: [{ provide: Window, useValue: window }],
  bootstrap: [AppComponent]
})
export class AppModule { }
