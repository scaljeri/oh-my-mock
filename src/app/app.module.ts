import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { RouterModule } from '@angular/router';
import { NgxsModule } from '@ngxs/store'
import { NgxsDispatchPluginModule } from "@ngxs-labs/dispatch-decorator";

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { ComponentsModule } from './components/components.module';
import { OhMyState } from './store/state';

@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    BrowserModule,
    RouterModule.forRoot([]),
    NgxsModule.forRoot([OhMyState], { developmentMode: true }),
    NgxsDispatchPluginModule.forRoot(),
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatSlideToggleModule,
    ComponentsModule
  ],
  providers: [{ provide: Window, useValue: window}],
  bootstrap: [AppComponent]
})
export class AppModule { }
