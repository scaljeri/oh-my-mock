import { Injectable } from '@angular/core';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { IOhMyStorageUpdate, StorageUtils } from '@shared/utils/storage';
import { IOhMyMock, IState, IMock } from '@shared/type';
import { UpdateStateStorage, UpdateStoreStorage, UpsertResponseStorage } from '../store/storage-actions';
import { objectTypes } from '@shared/constants';

/*
  This service receives updates from chrome.storage. This can happen when the
  content script modifies the state or there are multiple popups for different
  domains active
*/

@Injectable({
  providedIn: 'root'
})
export class UpdatesReceiverService {

  @Dispatch() updateStore = (store: IOhMyMock) => new UpdateStoreStorage(store);
  @Dispatch() updateState = (state: IState) => new UpdateStateStorage(state);
  @Dispatch() upsertResponse = (mock: IMock) => new UpsertResponseStorage(mock);


  constructor() {
    StorageUtils.listen();
    StorageUtils.updates$.subscribe(({ key, update }: IOhMyStorageUpdate) => {
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
