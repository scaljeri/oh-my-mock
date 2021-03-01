import { IState, IData, IMock, IDeleteData, IDeleteMock } from '@shared/type';

export class EnableDomain {
  static readonly type = '[Domain] Enable';
  constructor(public payload: boolean) { }
}

export class InitState {
  static readonly type = '[Domain] Init';
  constructor(public payload: IState = { domain: '', data: [] }) { }
}

export class UpsertData {
  static readonly type = '[Data] upsert';
  constructor(public payload: IData) { }
}

export class UpsertMock {
  static readonly type = '[Mock] upsert';
  constructor(public payload: IMock) { }
}

export class DeleteData {
  static readonly type = '[Data] delete';
  constructor(public payload: IDeleteData) { }
}

export class DeleteMock {
  static readonly type = '[Mock] delete';
  constructor(public payload: IDeleteMock) { }
}
