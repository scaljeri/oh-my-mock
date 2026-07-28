import { objectTypes } from '../constants';
import { IData, IMock, IOhMyShallowMock, IOhMyContext, ohMyMockId, ohMyPresetId, IOhMyPresets } from '../type';
import { StorageUtils } from './storage';
import { uniqueId } from './unique-id';
import { url2regex } from './urls';

export class DataUtils {
  static StorageUtils = StorageUtils;

  static init(data: Partial<IData> = {}): IData {
    return this.create(data);
  }

  static getSelectedResponse(data: IData, context: IOhMyContext | ohMyPresetId): IOhMyShallowMock | undefined {
    let presetId = context as ohMyPresetId;

    if (typeof context === 'object') {
      presetId = context.preset;
    }

    return data.mocks[data.selected[presetId]];
  }

  static isSPresetEnabled(data: IData, context: IOhMyContext): boolean {
    return data.enabled[context.preset];
  }

  static activeMock(data: IData, context: IOhMyContext): ohMyMockId | undefined {
    return data.enabled[context.preset] ? data.selected[context.preset] : undefined;
  }

  // A mock can only be attached to a request once it has an id and a status
  // code, which is what makes it findable afterwards. Declaring the parameter
  // as a bare `Partial<IMock>` forced three casts here and hid the requirement.
  static addResponse(context: IOhMyContext, data: IData, mock: IOhMyShallowMock & Partial<IMock>, autoActivate = true): IData {
    data = {
      ...data, mocks:
      {
        ...data.mocks, [mock.id]: {
          id: mock.id,
          statusCode: mock.statusCode,
          label: mock.label,
          modifiedOn: mock.modifiedOn
        }
      }, selected: { ...data.selected },
      enabled: { ...data.enabled }
    };

    if (Object.keys(data.mocks).length === 1) {
      data.selected[context.preset] = mock.id;

      if (autoActivate) {
        data.enabled[context.preset] = true;
      }
    }

    return data;
  }

  static removeResponse(context: IOhMyContext, data: IData, mockId: ohMyMockId): IData {
    data = {
      ...data,
      selected: { ...data.selected },
      enabled: { ...data.enabled },
      mocks: { ...data.mocks }
    };
    // TODO: The following assumes that only the active mock can be deleted
    delete data.mocks[mockId];
    delete data.selected[context.preset];
    delete data.enabled[context.preset];

    const nextActiveMock = DataUtils.getNextActiveResponse(data);

    if (nextActiveMock) {
      data.selected[context.preset] = nextActiveMock.id;
      data.enabled[context.preset] = false;
    }

    return data;
  }

  // Returns `undefined` when the request has no mocks left — which is exactly
  // the case `removeResponse` below checks for.
  static getNextActiveResponse(data: IData): IOhMyShallowMock | undefined {
    // TODO: make more advanced
    return Object.values(data.mocks).sort(this.statusCodeSort)?.[0];
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

  static create(data: Partial<IData>): IData {
    const output = {
      id: uniqueId(),
      enabled: {},
      selected: {},
      mocks: {},
      lastHit: Date.now(),
      ...data,
      type: objectTypes.REQUEST,
    } as IData;

    if (!data?.id && data?.url) {
      output.url = url2regex(data.url);
    }

    return output;
  }

  static statusCodeSort(a: { statusCode: number }, b: { statusCode: number }): number {
    return a.statusCode === b.statusCode ? 0 : a.statusCode > b.statusCode ? 1 : -1;
  }

  static prefillWithPresets(request: IData, presets: IOhMyPresets = {}, active?: boolean): IData {
    request.selected ??= {};
    request.enabled ??= {};

    const responses = Object.values(request.mocks).sort(DataUtils.statusCodeSort);

    Object.keys(presets).forEach(p => {
      if (active !== undefined) {
        request.enabled[p] = active;
      } else {
        request.enabled[p] ??= false;
      }
      request.selected[p] ??= responses[0]?.id;
    });

    return request;
  }
}
