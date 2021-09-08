import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { RouterModule } from '@angular/router';
import { NgxsModule } from '@ngxs/store';
import { NgxsDispatchPluginModule } from '@ngxs-labs/dispatch-decorator';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatBadgeModule } from '@angular/material/badge';
import { ComponentsModule } from './components/components.module';
import { OhMyState } from './store/state';

import { appRoutes } from './app.routes';
import { ReactiveFormsModule } from '@angular/forms';
import { HotToastModule } from '@ngneat/hot-toast';
import { NgApimockPluginModule } from './plugins/ngapimock/ngapimock.module';
import { PageMockComponent } from './pages/mock/mock.component';
import { PageDataListComponent } from './pages/data-list/data-list.component';
import { JsonExportComponent } from './pages/json-export/json-export.component';
import { CloudSyncPageComponent } from './pages/cloud-sync/cloud-sync-page.component';

@NgModule({
  declarations: [
    AppComponent,
    PageMockComponent,
    PageDataListComponent,
    JsonExportComponent,
    CloudSyncPageComponent,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    RouterModule.forRoot(appRoutes, { useHash: true } ),
    NgxsModule.forRoot([OhMyState], { developmentMode: false }),
    ReactiveFormsModule,
    NgxsDispatchPluginModule.forRoot(),
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatSidenavModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatBadgeModule,
    MatSnackBarModule,
    HotToastModule.forRoot(),
    ComponentsModule,
    NgApimockPluginModule,
  ],
  providers: [{ provide: Window, useValue: window }],
  bootstrap: [AppComponent]
})
export class AppModule { }
