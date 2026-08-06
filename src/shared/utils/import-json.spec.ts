import { objectTypes, STORAGE_KEY } from '../constants';
import { IData, IMock, IOhMyCookie, IOhMyMock, IState } from '../type';
import { importJSON, ImportResultEnum, IOhMyBackupInput } from './import-json';
import { MigrateUtils } from './migrate';
import { IOhMyStoredRecord } from './migrations/types';
import { StorageUtils } from './storage';
import { StoreRegistrar } from './store-registrar';

const CONTEXT = { domain: 'test.dev', preset: 'default', active: true };

// The step doubles read the record the way a real step does — through `in`,
// because `IOhMyStoredRecord` promises nothing beyond `version`. A record
// marked `tooOld` is given up on, which is how a real step reports a record
// older than `OLDEST_MIGRATABLE`.
const dropTooOld = (data: IOhMyStoredRecord): IOhMyStoredRecord | null =>
  'tooOld' in data && data.tooOld ? null : data;

const request = (partial: Partial<IData> & { tooOld?: boolean }): IData => ({
  id: 'req',
  url: '/api',
  method: 'GET',
  requestType: 'XHR',
  selected: {},
  enabled: {},
  mocks: {},
  lastHit: 1,
  lastModified: 1,
  version: MigrateUtils.version,
  type: objectTypes.REQUEST,
  ...partial
} as IData);

const response = (partial: Partial<IMock> & { tooOld?: boolean }): IMock => ({
  id: 'mock',
  statusCode: 200,
  version: MigrateUtils.version,
  type: objectTypes.MOCK,
  ...partial
} as IMock);

describe('Utils/importJSON', () => {
  const originalVersion = MigrateUtils.version;
  const originalRequestSteps = MigrateUtils.requestSteps;
  const originalMockSteps = MigrateUtils.mockSteps;

  let storage: Map<string, unknown>;
  let sUtils: typeof StorageUtils;
  let addDomain: jest.Mock;
  const originalAddDomain = StoreRegistrar.addDomain;

  beforeEach(() => {
    addDomain = jest.fn(() => Promise.resolve());
    StoreRegistrar.addDomain = addDomain;
    storage = new Map<string, unknown>();
    // `importJSON` registers a brand new domain on the store, so one has to
    // exist before anything can be imported into it.
    storage.set(STORAGE_KEY, { type: objectTypes.STORE, domains: [], version: MigrateUtils.version });

    sUtils = {
      get: jest.fn((key: string = STORAGE_KEY) => Promise.resolve(storage.get(key))),
      set: jest.fn((key: string, value: unknown) => {
        storage.set(key, value);
        return Promise.resolve();
      }),
      setStore: jest.fn((store: IOhMyMock) => {
        storage.set(STORAGE_KEY, store);
        return Promise.resolve();
      })
    } as unknown as typeof StorageUtils;
  });

  afterEach(() => {
    StoreRegistrar.addDomain = originalAddDomain;
    MigrateUtils.version = originalVersion;
    MigrateUtils.requestSteps = originalRequestSteps;
    MigrateUtils.mockSteps = originalMockSteps;
  });

  const state = (): IState => storage.get(CONTEXT.domain) as IState;
  const backup = (partial: Partial<IOhMyBackupInput>): IOhMyBackupInput => ({
    requests: [],
    responses: [],
    version: MigrateUtils.version,
    ...partial
  });

  describe('a backup where only some records are too old', () => {
    beforeEach(() => {
      MigrateUtils.version = '2.0.0';
      MigrateUtils.requestSteps = [dropTooOld];
      MigrateUtils.mockSteps = [dropTooOld];
    });

    it('imports the healthy records and drops the unmigratable ones', async () => {
      const result = await importJSON(backup({
        version: '1.0.0',
        requests: [
          request({ id: 'req1', url: '/api/a', version: '1.0.0', mocks: { m1: { id: 'm1', statusCode: 200 } } }),
          request({ id: 'req2', url: '/api/b', version: '1.0.0', tooOld: true })
        ],
        responses: [
          response({ id: 'm1', version: '1.0.0' }),
          response({ id: 'm2', version: '1.0.0', tooOld: true })
        ]
      }), CONTEXT, sUtils);

      expect(result.status).toBe(ImportResultEnum.SUCCESS);
      // The counts describe what was stored, so a caller can report how much
      // of the file made it and how much did not.
      expect(result.requests).toBe(1);
      expect(result.responses).toBe(1);
      expect(state().requests).toEqual(['req1']);
      expect(storage.get('req2')).toBeUndefined();
      expect(storage.get('m1')).toBeDefined();
      expect(storage.get('m2')).toBeUndefined();
    });

    it('imports the healthy records even when an unmigratable one comes first', async () => {
      // The order matters: a null in front used to short-circuit the whole
      // import into TOO_OLD, silently discarding every valid record behind it.
      const result = await importJSON(backup({
        version: '1.0.0',
        requests: [
          request({ id: 'req2', url: '/api/b', version: '1.0.0', tooOld: true }),
          request({ id: 'req1', url: '/api/a', version: '1.0.0' })
        ]
      }), CONTEXT, sUtils);

      expect(result.status).toBe(ImportResultEnum.SUCCESS);
      expect(state().requests).toEqual(['req1']);
    });

    it('prunes references to a response that was dropped', async () => {
      await importJSON(backup({
        version: '1.0.0',
        requests: [
          request({
            id: 'req1',
            version: '1.0.0',
            mocks: {
              m1: { id: 'm1', statusCode: 200 },
              m2: { id: 'm2', statusCode: 500 }
            },
            selected: { default: 'm2' }
          })
        ],
        responses: [
          response({ id: 'm1', version: '1.0.0' }),
          response({ id: 'm2', version: '1.0.0', statusCode: 500, tooOld: true })
        ]
      }), CONTEXT, sUtils);

      const stored = storage.get('req1') as IData;

      expect(Object.keys(stored.mocks)).toEqual(['m1']);
      // The selection aimed at the dropped response; it falls back to a
      // response that actually exists rather than serving a phantom.
      expect(stored.selected.default).toBe('m1');
    });

    it('still answers TOO_OLD when nothing survives', async () => {
      const result = await importJSON(backup({
        version: '1.0.0',
        requests: [request({ id: 'req1', version: '1.0.0', tooOld: true })],
        responses: [response({ id: 'm1', version: '1.0.0', tooOld: true })]
      }), CONTEXT, sUtils);

      expect(result.status).toBe(ImportResultEnum.TOO_OLD);
      expect(storage.get(CONTEXT.domain)).toBeUndefined();
    });
  });

  it('drops calledAt — imported traffic never happened in this browser', async () => {
    await importJSON(backup({
      requests: [request({ id: 'req1', calledAt: 123456 })]
    }), CONTEXT, sUtils);

    const stored = storage.get('req1') as IData;

    expect(stored).toBeDefined();
    expect('calledAt' in stored).toBe(false);
  });

  it('keeps the calledAt of the record it overwrites', async () => {
    // Importing a backup over the record it was exported from must not tell the
    // opposite lie: this request was called in *this* browser, and the import
    // stripping `calledAt` off the incoming copy used to take that fact with it.
    storage.set('req1', request({ id: 'req1', url: '/api/a', calledAt: 987654 }));

    await importJSON(backup({
      requests: [request({ id: 'req1', url: '/api/a', calledAt: 123456 })]
    }), CONTEXT, sUtils);

    expect((storage.get('req1') as IData).calledAt).toBe(987654);
  });

  describe('id collisions with unrelated records', () => {
    it('leaves an occupant of another type alone and remints the request id', async () => {
      const occupant = response({ id: 'busy' });
      storage.set('busy', occupant);

      await importJSON(backup({
        requests: [request({ id: 'busy', url: '/api/collide' })]
      }), CONTEXT, sUtils);

      // The unrelated record survives untouched…
      expect(storage.get('busy')).toBe(occupant);

      // …and the imported request still arrives, under a fresh id.
      const [id] = state().requests;

      expect(id).not.toBe('busy');
      expect((storage.get(id) as IData).url).toBe('/api/collide');
    });

    it('remints a colliding response id and follows it through the owning request', async () => {
      const occupant = request({ id: 'taken' });
      storage.set('taken', occupant);

      await importJSON(backup({
        requests: [request({
          id: 'req1',
          mocks: { taken: { id: 'taken', statusCode: 200 } },
          selected: { default: 'taken' }
        })],
        responses: [response({ id: 'taken' })]
      }), CONTEXT, sUtils);

      expect(storage.get('taken')).toBe(occupant);

      const stored = storage.get('req1') as IData;
      const [freshId] = Object.keys(stored.mocks);

      expect(freshId).not.toBe('taken');
      expect(stored.selected.default).toBe(freshId);
      expect((storage.get(freshId) as IMock).statusCode).toBe(200);
    });

    it('remints a colliding cookie id', async () => {
      const occupant = request({ id: 'c1' });
      storage.set('c1', occupant);

      await importJSON(backup({
        cookies: [{
          id: 'c1',
          name: 'session',
          value: 'abc',
          enabled: {},
          version: MigrateUtils.version,
          type: objectTypes.COOKIE
        } as IOhMyCookie]
      }), CONTEXT, sUtils);

      expect(storage.get('c1')).toBe(occupant);

      const [id] = state().cookies ?? [];

      expect(id).not.toBe('c1');
      expect((storage.get(id) as IOhMyCookie).name).toBe('session');
    });
  });

  describe('presets carried by the backup', () => {
    it('restores per-preset selection and on/off, matching presets by label', async () => {
      await importJSON(backup({
        // `aa` matches the target's default preset by label; `bb` does not
        // exist there and has to be created for its entries to mean anything.
        presets: { aa: 'Default', bb: 'Offline' },
        requests: [request({
          id: 'req1',
          mocks: {
            m1: { id: 'm1', statusCode: 200 },
            m2: { id: 'm2', statusCode: 500 }
          },
          selected: { aa: 'm2', bb: 'm1' },
          enabled: { aa: true, bb: false }
        })],
        responses: [response({ id: 'm1' }), response({ id: 'm2', statusCode: 500 })]
      }), CONTEXT, sUtils);

      expect(state().presets).toEqual({ default: 'Default', bb: 'Offline' });

      const stored = storage.get('req1') as IData;

      // `context.active` is true here; flattening `enabled` with it is exactly
      // what used to make per-preset on/off unrecoverable.
      expect(stored.enabled).toEqual({ default: true, bb: false });
      expect(stored.selected).toEqual({ default: 'm2', bb: 'm1' });
    });

    it('still prefills an old backup that carries no presets', async () => {
      // Written before presets were exported: `selected`/`enabled` are empty
      // and the target's presets decide everything, as they always did.
      await importJSON(backup({
        requests: [request({
          id: 'req1',
          mocks: {
            m1: { id: 'm1', statusCode: 200 },
            m2: { id: 'm2', statusCode: 500 }
          }
        })],
        responses: [response({ id: 'm1' }), response({ id: 'm2', statusCode: 500 })]
      }), CONTEXT, sUtils);

      const stored = storage.get('req1') as IData;

      expect(stored.enabled).toEqual({ default: true });
      expect(stored.selected).toEqual({ default: 'm1' });
    });
  });
  /**
   * An import runs in the popup as well as in the background, so it is in no
   * position to write the store record: reading it, adding the domain and
   * writing it back discarded whatever the background had put there in the
   * meantime — another domain, a group `ensureGroups` had just created, the
   * popup's own `popupActive`. It asks instead, and the background applies the
   * change to the record as it stands.
   */
  describe('registering the imported domain', () => {
    it('asks for the domain to be added rather than writing the store', async () => {
      await importJSON(backup({
        requests: [request({ id: 'req1' })],
        responses: [response({ id: 'm1' })]
      }), CONTEXT, sUtils);

      expect(addDomain).toHaveBeenCalledWith(CONTEXT.domain);
      expect(sUtils.setStore).not.toHaveBeenCalled();
      // Not through `set` under the store's key either, which is the same write
      // by another name.
      expect(sUtils.set).not.toHaveBeenCalledWith(STORAGE_KEY, expect.anything());
    });

    it('asks even when the store already lists the domain', async () => {
      // Whether it is listed is decided where the write is serialised. A guard
      // here could only be based on a read that another writer may already have
      // moved past.
      storage.set(STORAGE_KEY, {
        type: objectTypes.STORE,
        domains: [CONTEXT.domain],
        version: MigrateUtils.version
      });

      await importJSON(backup({
        requests: [request({ id: 'req1' })],
        responses: [response({ id: 'm1' })]
      }), CONTEXT, sUtils);

      expect(addDomain).toHaveBeenCalledWith(CONTEXT.domain);
    });
  });
});
