
export * from './types/base';
export * from './types/domain';
export * from './types/request';
export * from './types/response';
export * from './types/preset';
export * from './types/api-request';
export * from './types/api-response';














// export interface IState {
//   version: string;
//   name?: string;
//   type: objectTypes.STATE;
//   domain: string;
//   data: Record<ohMyDataId, IData>;
//   aux: IOhMyAux;
//   presets: Record<ohMyPresetId, string>;
//   context: IOhMyContext;
//   modifiedOn?: string;
// }

// url, method and type are used to map an API request with a response


// export interface IData extends IOhMyMockContext {
//   selected: Record<ohMyPresetId, ohMyMockId>;
//   enabled: Record<ohMyPresetId, boolean>;
//   mocks: Record<ohMyMockId, IOhMyShallowMock>;
//   lastHit: number;
//   lastModified: number;
//   version: string;
//   type: objectTypes.REQUEST;
// }





// export interface IMock {
//   id: ohMyMockId;
//   version: string;
//   type: objectTypes.MOCK;
//   label?: string;
//   statusCode: statusCode;
//   response?: string;
//   responseMock?: string;
//   headers?: Record<string, string>;
//   headersMock?: Record<string, string>;
//   delay?: number;
//   jsCode?: string;
//   rules?: IOhMyMockRule[];
//   createdOn?: string;
//   modifiedOn?: string;
// }





// actions


// export interface IPacket<T = any> {
//   tabId?: number;
//   domain?: string;
//   source: appSources;
//   payload: IPacketPayload<T>;
// }

// export interface IPacketPayload<T = unknown> {
//   type: packetTypes;
//   context?: IOhMyMockContext;
//   data?: T;
// }

// export interface IMockedTmpResponse {
//   [STORAGE_KEY]: {
//     sourceUrl: string;
//     mockUrl: string;
//     start: number;
//   };
// }

// TODO
import { resetStateOptions } from './constants';

export type ResetStateOptions = resetStateOptions;

// export interface IOhMyViewItemsOrder {
//   name: string;
//   id: string;
//   to: number;
// }

// export interface IOhMyEvalContext {
//   data: IData;
// request: IOhMyEvalRequest;
// }













