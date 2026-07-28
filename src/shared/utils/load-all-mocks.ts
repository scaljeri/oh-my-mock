import { Observable } from 'rxjs';
import { IData, IMock, IState } from '../type';
import { StorageUtils } from './storage';

export async function loadAllMocks(domain: string): Promise<Record<string, IMock>> {
  if (!domain) {
    return {};
  }

  const state = await StorageUtils.get<IState>(domain);

  if (!state) {
    return {};
  }

  // Requests are their own records now, so this is two batch reads instead of
  // one read per mock: first the domain's requests, then every mock they name.
  const requests = await StorageUtils.getMany<IData>(state.requests);
  const mockIds = Object.values(requests).flatMap(r => Object.keys(r.mocks));

  return StorageUtils.getMany<IMock>(mockIds);
}

export function loadAllMocks$(domain: string): Observable<Record<string, IMock>> {
  return new Observable(observer => {
    loadAllMocks(domain).then(mocks => {
      observer.next(mocks);
      observer.complete();
    });
  });
}
