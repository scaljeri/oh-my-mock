import { IOhMyMock, IState, ohMyDomain, IUpsertMock } from '@shared/type';

export class UpdateDomainsStorage {
  static readonly type = '[Storage] update Domains';
  constructor(public payload: IOhMyMock) { }
}

export class UpdateDomainStorage {
  static readonly type = '[Storage] update Domain';
  constructor(public payload: IState) { }
}

export class UpdateMockStorage {
  static readonly type = '[Storage] update Mock';
  constructor(public payload: IUpsertMock, public domain?: ohMyDomain) { }
}

export class DeleteMockStorage {
  static readonly type = '[Storage] delete Mock';
  constructor(public payload: IUpsertMock, public domain?: ohMyDomain) { }
}
