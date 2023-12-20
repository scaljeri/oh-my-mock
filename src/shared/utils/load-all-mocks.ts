import { Observable } from 'rxjs';
import { IOhMyResponse, IOhMyDomain, IOhMyDomainId, IOhMyRequestId, IOhMyRequest } from '../types';
import { StorageUtils } from './storage';

export async function loadAllMocks(domain: IOhMyDomainId): Promise<Record<string, IOhMyResponse>> {
  if (!domain) {
    return {};
  }

  const state = await StorageUtils.get<IOhMyDomain>(domain);

  if (!state) {
    return {};
  }

  const requests = await Promise.all(
    Object.values(state.requests).map(async (requestId: IOhMyRequestId) => {
      return StorageUtils.get<IOhMyRequest>(requestId);
    }))

  const responses = {};

  for (const request of requests) {
    for (const responseId in request.responses) {
      responses[responseId] = await StorageUtils.get<IOhMyResponse>(responseId);
    }
  }

  return responses;
}

export function loadAllMocks$(domain: string): Observable<Record<string, IOhMyResponse>> {
  return new Observable(observer => {
    loadAllMocks(domain).then(mocks => {
      observer.next(mocks);
      observer.complete();
    });
  });
}
