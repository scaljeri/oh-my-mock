import {
  IData,
  IUpsertMock,
  IOhMyMock,
  IOhMyViewItemsOrder,
  IOhMyToggle,
  ohMyMockId,
  ohMyDataId,
} from '@shared/type';

export class InitState {
  static readonly type = '[Domain] Init';
  constructor(public payload: Partial<IOhMyMock> = { domains: {} }) { }
}

export class ChangeDomain {
  static readonly type = '[Domain] Change';
  constructor(public payload: string) { }
}

export class ResetState {
  static readonly type = '[Domain] Reset';
  constructor(public payload: string) { }
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

export class Toggle {
  static readonly type = '[Toggle] update';
  constructor(public payload: IOhMyToggle) { }
}
