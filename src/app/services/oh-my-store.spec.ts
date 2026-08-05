import { TestBed } from '@angular/core/testing';
import { objectTypes, payloadType } from '@shared/constants';
import { IData, IOhMyContext, IOhMyCookie, IState } from '@shared/type';
import { IOhMyCookieUpdate } from '@shared/utils/cookie';
import { OhMySendToBg } from '@shared/utils/send-to-background';
import { OhMyState } from './oh-my-store';
import { StorageService } from './storage.service';

function state(over: Partial<IState> = {}): IState {
  return {
    version: '1.0.0',
    type: objectTypes.STATE,
    domain: 'example.com',
    requests: ['r1'],
    cookies: ['c1', 'c2'],
    aux: {},
    presets: { a: 'Logged in', b: 'Logged out' },
    context: { domain: 'example.com', preset: 'a' },
    ...over
  } as IState;
}

function cookie(over: Partial<IOhMyCookie> = {}): IOhMyCookie {
  return {
    id: 'c1',
    version: '1.0.0',
    type: objectTypes.COOKIE,
    name: 'session',
    value: 'mocked',
    enabled: { a: true, b: true },
    ...over
  };
}

describe('OhMyState (store service)', () => {
  let service: OhMyState;
  let records: Record<string, unknown>;
  let sent: jest.SpyInstance;

  const context: IOhMyContext = { domain: 'example.com', preset: 'a' };

  beforeEach(() => {
    records = {
      'example.com': state(),
      r1: {
        id: 'r1',
        mocks: { m1: { id: 'm1' } },
        selected: { a: 'm1', b: 'm1' },
        enabled: { a: true, b: false }
      } as unknown as IData,
      c1: cookie(),
      c2: cookie({ id: 'c2', name: 'other', enabled: { a: true } })
    };

    TestBed.configureTestingModule({
      providers: [{
        provide: StorageService,
        useValue: {
          get: jest.fn(async (key: string) => records[key]),
          getMany: jest.fn(async (keys: string[]) =>
            keys.reduce((acc, k) => (records[k] ? { ...acc, [k]: records[k] } : acc), {}))
        }
      }]
    });
    service = TestBed.inject(OhMyState);

    sent = jest.spyOn(OhMySendToBg, 'full').mockResolvedValue(undefined as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function cookieWrites(): IOhMyCookieUpdate[] {
    return sent.mock.calls
      .filter(c => c[1] === payloadType.COOKIE)
      .map(c => c[0] as IOhMyCookieUpdate);
  }

  describe('#deletePreset', () => {
    // `IOhMyCookie.enabled` is keyed by preset id, exactly like a request's.
    // Deleting a preset used to scrub the requests but not the cookie mocks,
    // so a later preset reusing the id inherited the cookie switched on.
    it('writes back every cookie mock that knew the deleted preset', async () => {
      await service.deletePreset('b', context);

      const writes = cookieWrites();
      expect(writes).toHaveLength(1);
      expect(writes[0].cookie).toEqual({ id: 'c1', enabled: { a: true, b: false } });
    });

    it('does not rewrite a cookie mock the preset never touched', async () => {
      await service.deletePreset('b', context);

      expect(cookieWrites().map(w => w.cookie.id)).not.toContain('c2');
    });

    it('still scrubs the requests and the state', async () => {
      await service.deletePreset('b', context);

      const requestWrite = sent.mock.calls.find(c => c[1] === payloadType.REQUEST);
      expect((requestWrite?.[0] as IData).selected.b).toBeUndefined();
      expect((requestWrite?.[0] as IData).enabled.b).toBeUndefined();

      const stateWrite = sent.mock.calls.find(c => c[1] === payloadType.STATE);
      expect((stateWrite?.[0] as IState).presets.b).toBeUndefined();
    });

    it('survives a state that predates cookie mocks', async () => {
      records['example.com'] = state({ cookies: undefined });

      await service.deletePreset('b', context);

      expect(cookieWrites()).toHaveLength(0);
      expect(sent.mock.calls.some(c => c[1] === payloadType.STATE)).toBe(true);
    });
  });
});
