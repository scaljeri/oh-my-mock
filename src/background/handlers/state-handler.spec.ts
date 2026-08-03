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
});
