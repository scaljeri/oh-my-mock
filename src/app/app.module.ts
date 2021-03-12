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
import { ComponentsModule } from './components/components.module';
import { OhMyState } from './store/state';
import { HomeComponent } from './pages/home/home.component';

import { MockModule } from './pages/mock/mock.module';
import { NgApiMockExportComponent } from './pages/exports/ng-api-mock-export/ng-api-mock-export.component';
import { StateExplorerModule } from './pages/state-explorer/state-explorer.module';
import { appRoutes } from './app.routes';
import { NgApimockSettingsComponent } from './plugins/ngapimock/ng-apimock-settings/ng-apimock-settings.component';
import { ReactiveFormsModule } from '@angular/forms';

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    NgApiMockExportComponent,
    NgApimockSettingsComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    RouterModule.forRoot(appRoutes, { useHash: true }),
    NgxsModule.forRoot([OhMyState], { developmentMode: true }),
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
    MatSnackBarModule,
    ComponentsModule,
    MockModule,
    StateExplorerModule
  ],
  providers: [{ provide: Window, useValue: window }],
  bootstrap: [AppComponent]
})
export class AppModule {}
