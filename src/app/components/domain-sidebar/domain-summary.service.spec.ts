import { TestBed } from '@angular/core/testing';
import { IState } from '@shared/type';
import { StorageService } from '../../services/storage.service';
import { countCookies, countRequests, DomainSummaryService } from './domain-summary.service';

describe('countRequests', () => {
  it('counts the ids in the request list', () => {
    expect(countRequests({ requests: ['a', 'b', 'c'] })).toBe(3);
  });

  it('counts the entries of the legacy embedded map', () => {
    expect(countRequests({ data: { a: {}, b: {} } })).toBe(2);
  });

  it('prefers the request list over the legacy map', () => {
    // A half-migrated record: the id list is the truth, the map is leftovers.
    expect(countRequests({ requests: ['a'], data: { a: {}, b: {}, c: {} } })).toBe(1);
  });

  it('counts an empty request list as zero, not as a missing list', () => {
    expect(countRequests({ requests: [], data: { a: {} } })).toBe(0);
  });

  it('is zero for a domain without a stored state', () => {
    expect(countRequests(undefined)).toBe(0);
    expect(countRequests(null)).toBe(0);
    expect(countRequests({})).toBe(0);
  });
});

describe('countCookies', () => {
  it('counts the cookie ids', () => {
    expect(countCookies({ cookies: ['c1', 'c2'] })).toBe(2);
  });

  it('is zero when the state has no cookies at all', () => {
    expect(countCookies({})).toBe(0);
    expect(countCookies(undefined)).toBe(0);
  });
});

describe('DomainSummaryService', () => {
  let service: DomainSummaryService;
  // Keyed by domain, like `chrome.storage` itself; a domain that is absent
  // resolves `undefined`, which is what the real storage does.
  let states: Record<string, Partial<IState>>;

  beforeEach(() => {
    states = {};

    TestBed.configureTestingModule({
      providers: [
        {
          provide: StorageService,
          useValue: {
            get: (key: string) => Promise.resolve(states[key]),
            getMany: (keys: string[]) => Promise.resolve(
              // Like `chrome.storage.local.get`: keys without a record are
              // left out of the result altogether.
              keys.reduce<Record<string, Partial<IState>>>((acc, key) => {
                if (states[key]) {
                  acc[key] = states[key];
                }

                return acc;
              }, {}))
          }
        }
      ]
    });

    service = TestBed.inject(DomainSummaryService);
  });

  it('summarises a domain from its stored state', async () => {
    states['example.com'] = { requests: ['a', 'b'], cookies: ['c1'] };

    await expect(service.summarise('example.com')).resolves.toEqual({
      domain: 'example.com',
      requests: 2,
      cookies: 1
    });
  });

  it('summarises a domain that has no state yet', async () => {
    await expect(service.summarise('fresh.dev')).resolves.toEqual({
      domain: 'fresh.dev',
      requests: 0,
      cookies: 0
    });
  });

  it('keeps the order it was given', async () => {
    states['b.io'] = { requests: ['x'] };

    const summaries = await service.summariseAll(['a.io', 'b.io']);

    expect(summaries.map(s => s.domain)).toEqual(['a.io', 'b.io']);
    expect(summaries.map(s => s.requests)).toEqual([0, 1]);
  });
});
