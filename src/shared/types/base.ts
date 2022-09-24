import { objectTypes, STORAGE_KEY } from '../constants';
import { IOhMyDomainId } from './domain';
import { IOhMyRequest } from './request';
import { IOhMyResponse } from './response';

// Represent the origin of the data. Right now only 'local' is supported
export type IOhMyOrigin = 'local' | 'cloud' | 'ngapimock';

export interface IStore {
  [STORAGE_KEY]: IOhMyMock;
}

export interface IOhMyMock {
  domains: IOhMyDomainId[];
  version: string;
  origin?: IOhMyOrigin;
  modifiedOn?: string;
  type: objectTypes.STORE;
  popupActive: boolean;
}

// Internal shizzle

// export interface IDispatchApiResponsePacket {
//   context?: IOhMyMockContext;
//   data: IOhMyMockContext
// }

export interface IOhMyPopupActive {
  active: boolean;
  tabId: number;
}

export interface IOhMyBackup {
  requests: IOhMyRequest[],
  responses: IOhMyResponse[],
  version: string;
}

export interface IOhMyInjectedState {
  active: boolean;
}
