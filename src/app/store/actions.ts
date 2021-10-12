import {
  IData,
  IUpsertMock,
  IOhMyMock,
  IOhMyViewItemsOrder,
  ohMyMockId,
  ohMyDataId,
  ohMyDomain,
  IOhMyScenarios,
  IOhMyShallowMock,
  domain,
  IState,
  ohMyScenarioId,
  IOhMyAux,
} from '@shared/type';

export class InitState {
  static readonly type = '[Domain] Init';
  constructor(public payload: Partial<IOhMyMock> = {}, public domain?: ohMyDomain) { }
}

export class ChangeDomain {
  static readonly type = '[Domain] Change';
  constructor(public payload: string) { }
}

export class ResetState {
  static readonly type = '[Domain] Reset';
  constructor(public payload: string) { }
}

export class UpdateState {
  static readonly type = '[State] Update';
  constructor(public payload: Partial<IState>) { }
}

export class UpsertData {
  static readonly type = '[Data] upsert';
  constructor(public payload: Partial<IData>, public domain?: string) { }
}

export class UpsertMock {
  static readonly type = '[Mock] upsert';
  constructor(public payload: IUpsertMock, public domain?: string) { }
}

export class DeleteData {
  static readonly type = '[Data] delete';
  constructor(public payload: string, public domain?: string) { }
}

export class DeleteMock {
  static readonly type = '[Mock] delete';
  constructor(public payload: { id: ohMyDataId, mockId: ohMyMockId }, public domain?: string) { }
}

export class ViewChangeOrderItems {
  static readonly type = '[ViewList] update order of items';
  constructor(public payload: IOhMyViewItemsOrder) { }
}

export class ViewReset {
  static readonly type = '[ViewList] reset';
  constructor(public payload: string) { }
}

export class Aux {
  static readonly type = '[Aux] update';
  constructor(public payload: IOhMyAux) { }
}

export class UpsertScenarios {
  static readonly type = 'Scenario upsert';
  constructor(public payload: IOhMyScenarios, public domain?: string) { }
}

export class LoadMock {
  static readonly type = '[Mock] load';
  constructor(public payload: Partial<IOhMyShallowMock>) {}
}

export class LoadState {
  static readonly type = '[State] load';
  constructor(public payload: domain) {}
}

export class ScenarioFilter {
  static readonly type = '[Filter] scenario';
  constructor(public payload: ohMyScenarioId) {}
}
