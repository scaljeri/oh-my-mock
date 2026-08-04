import { objectTypes, payloadType } from '../../shared/constants';
import { IOhMyPacketContext, IPacketPayload } from '../../shared/packet-type';
import { IOhMyMock, IState } from '../../shared/type';
import { StateUtils } from '../../shared/utils/state';
import { StorageUtils } from '../../shared/utils/storage';
import { OhMyStateHandler } from './state-handler';

/**
 * Which domain a state is written under.
 *
 * `OhMySendToBg.full` fills the packet context with the domain the popup is on,
 * whether or not the caller asked for one. This handler preferred that over the
 * domain the state names for itself — so a state created for somewhere else was
 * filed over the state of wherever you happened to be. "Add domain" did exactly
 * that: the new domain never appeared, and the mocks of the domain on screen
 * were replaced by an empty state. Nothing threw.
 */
describe('OhMyStateHandler', () => {
  let records: Record<string, unknown>;

  const payload = (
    data: unknown,
    context?: Partial<IOhMyPacketContext>
  ): IPacketPayload<unknown, IOhMyPacketContext> =>
    ({
      type: payloadType.STATE,
      data,
      context,
      description: 'spec'
    }) as IPacketPayload<unknown, IOhMyPacketContext>;

  beforeEach(() => {
    records = {
      OhMyMock: {
        type: objectTypes.STORE,
        version: '1.0.0',
        domains: ['on-screen.example']
      } as IOhMyMock,
      'on-screen.example': StateUtils.init({
        domain: 'on-screen.example',
        requests: ['r1']
      })
    };

    jest
      .spyOn(StorageUtils, 'get')
      .mockImplementation(async (key = 'OhMyMock') => records[key] as never);
    jest
      .spyOn(StorageUtils, 'set')
      .mockImplementation(async (key: string, value: unknown) => {
        records[key] = value;
      });
    jest
      .spyOn(StorageUtils, 'setStore')
      .mockImplementation(async (store: IOhMyMock) => {
        records['OhMyMock'] = store;
      });
    // `ensureGroups` reads the whole of storage when a domain has no group.
    StorageUtils.chrome = {
      storage: {
        local: {
          get: jest.fn(
            async (
              keys: unknown,
              callback?: (data: Record<string, unknown>) => void
            ) => {
              const data =
                keys === null
                  ? { ...records }
                  : Object.fromEntries(
                      (Array.isArray(keys) ? keys : [keys as string])
                        .filter(k => k in records)
                        .map(k => [k, records[k]])
                    );

              callback?.(data);

              return data;
            }
          )
        }
      }
    } as unknown as typeof StorageUtils.chrome;
    OhMyStateHandler.StorageUtils = StorageUtils;
  });

  afterEach(() => jest.restoreAllMocks());

  it('writes a full state under the domain the state itself names', async () => {
    const created = StateUtils.init({ domain: 'brand-new.example' });

    // The context is the popup's own domain, which is what `full()` puts there.
    await OhMyStateHandler.update(
      payload(created, { domain: 'on-screen.example' })
    );

    expect((records['brand-new.example'] as IState)?.domain).toBe(
      'brand-new.example'
    );
  });

  it('leaves the domain on screen exactly as it was', async () => {
    const before = records['on-screen.example'];

    await OhMyStateHandler.update(
      payload(StateUtils.init({ domain: 'brand-new.example' }), {
        domain: 'on-screen.example'
      })
    );

    expect(records['on-screen.example']).toBe(before);
    expect((records['on-screen.example'] as IState).requests).toEqual(['r1']);
  });

  it('adds the new domain to the store', async () => {
    await OhMyStateHandler.update(
      payload(StateUtils.init({ domain: 'brand-new.example' }), {
        domain: 'on-screen.example'
      })
    );

    expect((records['OhMyMock'] as IOhMyMock).domains).toContain(
      'brand-new.example'
    );
  });

  /**
   * The other way round for a patch: `data` is the value being patched in, not
   * a state, so only the context can say where it belongs.
   */
  it('a patch goes to the domain in the context', async () => {
    await OhMyStateHandler.update(
      payload(
        { filterKeywords: 'users' },
        {
          domain: 'on-screen.example',
          kind: 'patch',
          path: '$',
          propertyName: 'aux'
        }
      )
    );

    expect((records['on-screen.example'] as IState).aux).toEqual(
      expect.objectContaining({ filterKeywords: 'users' })
    );
    expect(records['brand-new.example']).toBeUndefined();
  });

  it('says so rather than guessing when nothing names a domain', async () => {
    expect(await OhMyStateHandler.update(payload({ nothing: true }))).toBeUndefined();
  });

  /**
   * A patch that forgot to say it was one used to be destructive.
   *
   * `response-handler` built its `filteredRequests` packet with `path` and
   * `propertyName` but no `kind`, so the handler took the full-state branch and
   * wrote the id array as the entire domain record — presets, aux, context and
   * the request list gone. TypeScript admitted it because the excess-property
   * check against a union accepts `path`/`propertyName` from the other
   * constituent. So the *shape* decides now, not the label.
   */
  it('treats a packet shaped like a patch as one, tag or no tag', async () => {
    await OhMyStateHandler.update(
      payload(['r1', 'r2'], {
        domain: 'on-screen.example',
        path: '$.aux',
        propertyName: 'filteredRequests'
      })
    );

    const state = records['on-screen.example'] as IState;

    expect(state.aux.filteredRequests).toEqual(['r1', 'r2']);
    // The things a full-state write would have destroyed.
    expect(state.requests).toEqual(['r1']);
    expect(state.presets).toEqual({ default: 'Default' });
    expect(state.domain).toBe('on-screen.example');
  });

  /**
   * Neither a state nor a patch. Writing it would replace everything the domain
   * has with whatever it is; refusing costs one lost update.
   */
  it('refuses to store something that is neither a state nor a patch', async () => {
    const before = records['on-screen.example'];

    const result = await OhMyStateHandler.update(
      payload(['r1', 'r2'], { domain: 'on-screen.example' })
    );

    expect(result).toBeUndefined();
    expect(records['on-screen.example']).toBe(before);
  });
});
