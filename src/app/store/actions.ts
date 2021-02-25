import { IState, IUpsertResponse } from '../../shared/type';

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
  static readonly type = '[Response] update';
  constructor(public payload: IUpsertResponse) { }
}

export class UpdateMock {
  static readonly type = '[Mock] update';
  constructor(public payload: any) { }
}
