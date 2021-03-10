import { IState, IData, IDeleteData, IDeleteMock, ICreateStatusCode, IUpdateDataUrl, IUpdateDataStatusCode, IUpsertMock, IOhMyMock } from '@shared/type';

export class EnableDomain {
  static readonly type = '[Domain] Enable';
  constructor(public payload: boolean) { }
}

export class InitState {
  static readonly type = '[Domain] Init';
  constructor(public payload: Partial<IOhMyMock> = { domains: {}, activeDomain: '' }) { }
}

export class InitGlobalState {
  static readonly type = '[Domain] Init';
  constructor(public payload: IOhMyMock = { domains: {} }) { }
}

export class ResetState {
  static readonly type = '[Domain] Reset';
  constructor(public payload: string) { }
}

export class UpsertData {
  static readonly type = '[Data] upsert';
  constructor(public payload: IData) { }
}

export class UpsertMock {
  static readonly type = '[Mock] upsert';
  constructor(public payload: IUpsertMock) { }
}

export class DeleteData {
  static readonly type = '[Data] delete';
  constructor(public payload: IDeleteData) { }
}

export class DeleteMock {
  static readonly type = '[Mock] delete';
  constructor(public payload: IDeleteMock) { }
}

export class CreateStatusCode {
  static readonly type = '[StatusCode] create';
  constructor(public payload: ICreateStatusCode) {}
}

export class UpdateDataUrl {
  static readonly type = '[Data] update url';
  constructor(public payload: IUpdateDataUrl) { }
}

export class UpdateDataStatusCode {
  static readonly type = '[Data] update status code';
  constructor(public payload: IUpdateDataStatusCode) { }
}
