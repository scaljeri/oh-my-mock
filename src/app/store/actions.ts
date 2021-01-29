export class EnableDomain {
  static readonly type = '[Domain] Enable';
  constructor(public payload: boolean) { }
}
