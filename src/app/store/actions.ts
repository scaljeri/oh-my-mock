import { IMock, IState } from './type';

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

export class UpdateMock {
  static readonly type = '[Mock] update';
  constructor(public payload: IMock) { }
}
