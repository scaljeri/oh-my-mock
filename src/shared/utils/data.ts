import { objectTypes } from '../constants';
import { IOhMyRequest, IOhMyRequestPreset, IOhMyPresetId, IOhMyShallowResponse, IOhMyResponseId, IOhMyResponse, IOhMyDomainPresets, IOhMyRequestId, IOhMyDomainContext, IOhMyPreset } from '../types';
import { StorageUtils } from './storage';
import { uniqueId } from './unique-id';
import { url2regex } from './urls';

export type IOhMyRequestLookup = (requestId: IOhMyRequestId) => Promise<IOhMyRequest>;
const VERSION = '__OH_MY_VERSION__';

export class DataUtils {
  static StorageUtils = StorageUtils;

  // static get(state: IState, id: ohMyDataId): IData {
  //   return { ...state.data[id], mocks: { ...state.data[id].mocks } };
  // }

  static init(data: Partial<IOhMyRequest> = {}): IOhMyRequest {
    return this.create(data);
  }

  static getSelectedResponse(request: IOhMyRequest, context: IOhMyDomainContext | IOhMyPresetId): IOhMyShallowResponse | undefined {
    let presetId = context as IOhMyPresetId;

    if (typeof context === 'object') {
      presetId = context.presetId;
    }
    const requestPreset = request.presets[presetId];

    return request.responses[requestPreset.responseId];
  }

  static isSPresetEnabled(data: IOhMyRequest, context: IOhMyDomainContext): boolean {
    return data.presets[context.presetId].isActive;
  }

  // Weird function, it just returns the response for the context, not sure what `active` means!!
  static activeResponse(request: IOhMyRequest, context: IOhMyDomainContext): IOhMyResponseId {
    return request.presets[context.presetId].responseId;
  }

  static addResponse(context: IOhMyDomainContext, request: IOhMyRequest, response: Partial<IOhMyResponse>, autoActivate = true): IOhMyRequest {
    request = {
      ...request,
      responses: {
        ...request.responses,
        [response.id]: {
          id: response.id,
          statusCode: response.statusCode,
          label: response.label,
          modifiedOn: response.modifiedOn
        }
      }, presets: { ...request.presets },
    };

    if (Object.keys(request.responses).length === 1) {
      request.presets[context.presetId] = {
        isActive: autoActivate,
        responseId: request.id,
        presetId: context.presetId,
        bodyId: 'default'
      } as IOhMyRequestPreset;
    }

    return request;
  }

  static removeResponse(request: IOhMyRequest, responseId: IOhMyResponseId): IOhMyRequest {
    request = {
      ...request,
      presets: { ...request.presets },
      responses: { ...request.responses }
    };
    // TODO: The following assumes that only the active mock can be deleted
    delete request.responses[responseId];

    const [presetId, preset] = Object.entries(request.presets).find(([, value]) => value.responseId === responseId) as [string, IOhMyPreset];
    if (presetId) {
      request.presets[presetId] = {
        ...preset,
        responseId: DataUtils.getNextActiveResponse(request)?.id
      }
    }

    return request;
  }

  static getNextActiveResponse(data: IOhMyRequest): IOhMyShallowResponse {
    // TODO: make more advanced
    return Object.values(data.responses).sort(this.statusCodeSort)?.[0];
  }

  // static activateMock(context: IOhMyContext, data: IData, mockId: ohMyMockId, scenario = null): IData {
  //   data = { ...data, selected: { ...data.selected }, enabled: { ...data.enabled } };

  //   data.selected[scenario] = mockId;
  //   data.enabled[scenario] = true;

  //   return data;
  // }

  // static deactivateResponse(context: IOhMyContext, data: IData): IData {
  //   data = { ...data, enabled: { ...data.enabled, [context.preset]: false } };

  //   return data
  // }

  static create(data: Partial<IOhMyRequest>): IOhMyRequest {
    const output = {
      id: uniqueId(),
      presets: {},
      responses: {},
      lastHit: Date.now(),
      ...data,
      type: objectTypes.REQUEST,
      version: VERSION
    } as IOhMyRequest;

    if (!data?.id && data?.url) {
      output.url = url2regex(data.url);
    }

    return output;
  }

  static statusCodeSort(a, b): number {
    return a.statusCode === b.statusCode ? 0 : a.statusCode > b.statusCode ? 1 : -1;
  }

  static prefillWithPresets(request: IOhMyRequest, presets: IOhMyDomainPresets = {}, active?: boolean): IOhMyRequest {
    const responses = Object.values(request.responses).sort(DataUtils.statusCodeSort);

    Object.keys(presets).forEach((presetId: IOhMyPresetId) => {
      request.presets[presetId] = {
        isActive: active || false,
        responseId: responses[0].id,
        bodyId: 'default'
      } as IOhMyRequestPreset
    });

    return request;
  }

  static loadRequest(requestId: IOhMyRequestId, requestLookup: IOhMyRequestLookup): Promise<IOhMyRequest> {
    return requestLookup(requestId);
  }


  static loadRequests(requestIds: IOhMyRequestId[], requestLookup: IOhMyRequestLookup): Promise<IOhMyRequest[]> {
    const otuput = requestIds.map(requestId => requestLookup(requestId));

    return Promise.all(otuput);
  }
}
