import { Injectable } from '@angular/core';

import { IMock, IOhMyMock, IState, IStore, ohMyDomain, ohMyMockId } from '@shared/type';
import { STORAGE_KEY } from '@shared/constants';
import { AppStateService } from './app-state.service';

import { IOhMyStorageUpdate, StorageUtils}  from '@shared/utils/storage';
import * as stateUtils from '@shared/utils/state';

const OH_MY_TICK = 'tick';

@Injectable({
	providedIn: 'root'
})
export class StorageService {
  static StorageUtils = StorageUtils;
	tick: number;

	constructor(private appState: AppStateService) {
		// this.reset();
		StorageService.StorageUtils.updates$.subscribe((changes: IOhMyStorageUpdate) => {
			console.log(changes);
		});
	}

	async initialize(): Promise<IOhMyMock> {
		return Promise.all<IOhMyMock, number>([
			StorageService.StorageUtils.get<IOhMyMock>(STORAGE_KEY),
      StorageService.StorageUtils.get<number>('TICK')
		]).then(([state, tick]: [IOhMyMock, number]) => {
			this.tick = tick;
			return state;
		});
	}

	updateState(update: IOhMyMock, key = STORAGE_KEY): void {
		chrome.storage.local.set({ [key]: update, [OH_MY_TICK]: this.tick });
	}

	updateDomain(update: IState): Promise<void> {
    return StorageService.StorageUtils.set(update.domain, update);
	}

	updateMock(update: IMock): Promise<void> {
    return StorageService.StorageUtils.set(update.id, update);
	}

	reset(key?: ohMyDomain | ohMyMockId): void {
		if (key) {
			chrome.storage.local.remove(key);
		} else {
			chrome.storage.local.clear();
		}
	}
}
