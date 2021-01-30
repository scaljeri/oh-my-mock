import { IState } from './type';

export class EnableDomain {
  static readonly type = '[Domain] Enable';
  constructor(public payload: boolean) { }
}

export class InitState {
  static readonly type = '[Domain] Init';
  constructor(public payload: IState) { }
}
