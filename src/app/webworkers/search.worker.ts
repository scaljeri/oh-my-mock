/// <reference lib="webworker" />
import { BehaviorSubject, filter, take } from 'rxjs';

import { deepSearch } from '@shared/utils/search';
import { IOhWWPacketSearch, IOhWWPacket, IOhWWPacketMocks, OhWWPacketTypes } from './types';

const MOCKS_CACHE = {};
const isInInitStateSubject = new BehaviorSubject<boolean>(false);

addEventListener('message', async ({ data }: { data: IOhWWPacket }) => {
  const { type, body } = data;

  const response: Partial<IOhWWPacket> = { id: data.id };

  switch (type) {
    case OhWWPacketTypes.INIT:
      isInInitStateSubject.next(true);
      break;
    case OhWWPacketTypes.INIT_DONE:
      isInInitStateSubject.next(false);
      break;
    case OhWWPacketTypes.MOCKS:
      receivedMocks(body as IOhWWPacketMocks);
      break;
    case OhWWPacketTypes.SEARCH:
      isInInitStateSubject.pipe(filter(isInit => !isInit), take(1)).subscribe(async () => {
        response.body = await doSearch(body as IOhWWPacketSearch);
        response.type = OhWWPacketTypes.SEARCH_RESULT;
        postMessage(response);
      });
      break;
    default:
      // eslint-disable-next-line no-console
      console.error('Not supported WebWorker action requested', body);
  }
});

function receivedMocks(mocks: IOhWWPacketMocks): void {
  Object.values(mocks).forEach(m => MOCKS_CACHE[m.id] = m);
}

async function doSearch({ terms, data }: IOhWWPacketSearch): Promise<string[]> {
  return (await deepSearch(data, terms, MOCKS_CACHE)).map(d => d.id);
}
