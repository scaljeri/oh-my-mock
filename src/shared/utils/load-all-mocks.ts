import { Observable } from 'rxjs';
import { IMock, IState } from '../type';
import { StorageUtils } from './storage';

export async function loadAllMocks(domain: string): Promise<Record<string, IMock>> {
  const state = await StorageUtils.get<IState>(domain);
  const data = Object.values(state.data);

  const mocks = {};
  for (let i = 0; i < data.length; i++) {
    const keys = Object.keys(data[i].mocks);

    for (let j = 0; j < keys.length; j++) {
      mocks[keys[j]] = await StorageUtils.get(keys[j]);
    }
  }

  return mocks;
}

export function loadAllMocks$(domain: string): Observable<Record<string, IMock>> {
  return new Observable(observer => {
    loadAllMocks(domain).then(mocks => {
      observer.next(mocks);
      observer.complete();
    });
  });
}
