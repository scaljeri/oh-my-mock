import {
  IData,
  IUpsertMock,
  IOhMyMock,
  ohMyMockId,
  ohMyDataId,
  IOhMyPresets,
  IOhMyShallowMock,
  domain,
  IState,
  ohMyPresetId,
  IOhMyAux,
  IOhMyPresetChange,
  IOhMyContext,
} from '@shared/type';

export class InitState {
  static readonly type = '[Domain] Init';
  constructor(public payload: Partial<IOhMyMock> = {}, public context: IOhMyContext) { }
}

export class ChangeDomain {
  static readonly type = '[Domain] Change';
  constructor(public payload: string) { }
}

export class ResetState {
  static readonly type = '[Domain] Reset';
  constructor(public payload: string, public context: IOhMyContext) { }
}

export class UpdateState {
  static readonly type = '[State] Update';
  constructor(public payload: Partial<IState>) { }
}

export class UpsertData {
  static readonly type = '[Data] upsert';
  constructor(public payload: Partial<IData> | Partial<IData>[], public context: IOhMyContext) {
    if (!Array.isArray(payload)) {
      this.payload = [payload];
    }
  }
}

export class UpsertMock {
  static readonly type = '[Mock] upsert';
  constructor(public payload: IUpsertMock, public context: IOhMyContext) { }
}

export class DeleteData {
  static readonly type = '[Data] delete';
  constructor(public payload: string, public context: IOhMyContext) { }
}

export class DeleteMock {
  static readonly type = '[Mock] delete';
  constructor(public payload: { id: ohMyDataId, mockId: ohMyMockId }, public context: IOhMyContext) { }
}

export class Aux {
  static readonly type = '[Aux] update';
  constructor(public payload: IOhMyAux, public context: IOhMyContext) { }
}

export class UpsertScenarios {
  static readonly type = 'Scenario upsert';
  constructor(public payload: IOhMyPresets, public context: IOhMyContext) { }
}

export class LoadMock {
  static readonly type = '[Mock] load';
  constructor(public payload: Partial<IOhMyShallowMock>) { }
}

export class LoadState {
  static readonly type = '[State] load';
  constructor(public payload: domain) { }
}

export class ScenarioFilter {
  static readonly type = '[Filter] scenario';
  constructor(public payload: ohMyPresetId) { }
}

export class PresetCreate {
  static readonly type = '[Preset] create';
  constructor(public payload: IOhMyPresetChange[] | IOhMyPresetChange, public context: IOhMyContext) { }
}
