import { IResponses, IState, IDeleteResponse, IUpsertResponse } from '@shared/type';

export class EnableDomain {
  static readonly type = '[Domain] Enable';
  constructor(public payload: boolean) { }
}

export class InitState {
  static readonly type = '[Domain] Init';
  constructor(public payload: IState) { }
}

export class StateReset {
  static readonly type = '[Domain] Reset';
  constructor() { }
}

export class UpsertResponse {
  static readonly type = '[Response] upsert';
  constructor(public payload: IUpsertResponse) { }
}

export class UpsertResponses {
  static readonly type = '[Responses] upsert';
  constructor(public payload: IResponses) { }
}

export class UpdateMock {
  static readonly type = '[Mock] update';
  constructor(public payload: any) { }
}

export class DeleteResponse {
  static readonly type = '[Response] delete';
  constructor(public payload: IDeleteResponse) { }
}
