import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { Inject, NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { RouterModule } from '@angular/router';
import { NgxsModule } from '@ngxs/store';
import { Dispatch, NgxsDispatchPluginModule } from '@ngxs-labs/dispatch-decorator';

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
import { IOhMyStorageUpdate, StorageUtils } from '@shared/utils/storage';
import { UpdateStateStorage, UpdateStoreStorage, UpsertResponseStorage } from './store/storage-actions';
import { IMock, IOhMyMock, IState } from '@shared/type';
import { objectTypes } from '@shared/constants';
import { StateStreamService } from './services/state-stream.service';

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
    RouterModule.forRoot(appRoutes, { useHash: true, scrollPositionRestoration: 'enabled' }),
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
export class AppModule {

  @Dispatch() updateStore = (store: IOhMyMock) => new UpdateStoreStorage(store);
  @Dispatch() updateState = (state: IState) => new UpdateStateStorage(state);
  @Dispatch() upsertResponse = (mock: IMock) => new UpsertResponseStorage(mock);

  constructor(private stateStream: StateStreamService) {
    StorageUtils.listen();
    StorageUtils.updates$.subscribe(({ key, update }: IOhMyStorageUpdate) => {
      debugger;
      switch (update.newValue.type) {
        case objectTypes.STATE:
          this.updateState(update.newValue as IState);
          break;
        case objectTypes.MOCK:
          this.upsertResponse(update.newValue as IMock);
          break;
        case objectTypes.STORE:
          this.updateStore(update.newValue as IOhMyMock);
          break;
      }
    });
  }
}

chrome.storage.local.get(null, function (data) { console.log('ALL DATA: ', data); })
