import { objectTypes, payloadType, STORAGE_KEY } from '../../shared/constants';
import { IData, IMock, IOhMyMock } from '../../shared/type';
import { IPacket } from '../../shared/packet-type';
import { ImportResultEnum, IOhMyBackupInput, IOhMyImportResult } from '../../shared/utils/import-json';
import { MigrateUtils } from '../../shared/utils/migrate';
import { OhMyQueue } from '../../shared/utils/queue';
import { StorageUtils } from '../../shared/utils/storage';
import { initStorage } from '../init';
// Also what puts the background's own `addDomain` on `StoreRegistrar`: it does
// so at module scope in `store-writer.ts`, which this pulls in. Without it an
// import running here would try to *ask* for the domain to be listed over
// `chrome.runtime`, which is the popup's implementation and answers nobody.
import { resetEverything } from '../reset-everything';
import { forgetWipes, notWhileWiping, wipesRunOn } from '../wipe-barrier';
import { OhMyImportHandler } from './import';

// The store scan a reset ends in. Exercised here only for *when* it runs; what
// it writes is `init.spec.ts`'s business.
jest.mock('../init', () => ({ initStorage: jest.fn() }));

/** A storage round trip that does not finish in the turn it started in. */
const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

/** Long enough for an unguarded reset to have reached the clear. */
const severalTicks = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await tick();
  }
};

/**
 * The import, run where a full reset can see it.
 *
 * The `.json` and HAR dialogs used to call `importJSON` in the popup's own
 * process. `wipe-barrier.ts` keeps a reset apart from everything else by
 * holding the background's message queue shut and waiting for every lane to
 * fall quiet, and it cannot see a write from another process at all — so an
 * import racing a reset landed in the middle of the wipe and left records
 * nothing lists. Sending the backup to this handler puts it behind that door.
 *
 * The reset wins, and the sender is told: the records are written, the wipe
 * deletes them, and the answer says DISCARDED rather than reporting a success
 * for records that no longer exist.
 *
 * Every double below resolves a turn late on purpose, and the import occupies
 * the queue **before** the reset joins it. A fake that answers synchronously,
 * or a reset sent first, interleaves nothing and would pass whatever the code
 * did.
 */
describe('the import handler', () => {
  let records: Record<string, unknown>;
  let queue: OhMyQueue;
  const realChrome = StorageUtils.chrome;

  const store = (): IOhMyMock => ({
    type: objectTypes.STORE,
    version: MigrateUtils.version,
    domains: [],
    groups: []
  } as unknown as IOhMyMock);

  const request = (id: string): IData => ({
    id,
    url: '/api',
    method: 'GET',
    requestType: 'XHR',
    selected: {},
    enabled: {},
    mocks: {},
    lastHit: 1,
    lastModified: 1,
    version: MigrateUtils.version,
    type: objectTypes.REQUEST
  } as unknown as IData);

  const response = (id: string): IMock => ({
    id,
    statusCode: 200,
    version: MigrateUtils.version,
    type: objectTypes.MOCK
  } as unknown as IMock);

  const backup = (): IOhMyBackupInput => ({
    requests: [request('req-1'), request('req-2')] as unknown as IOhMyBackupInput['requests'],
    responses: [response('mock-1'), response('mock-2')] as unknown as IOhMyBackupInput['responses'],
    version: MigrateUtils.version
  });

  beforeEach(() => {
    records = { [STORAGE_KEY]: store() };

    jest.spyOn(StorageUtils, 'get').mockImplementation(async (key = STORAGE_KEY) => {
      await tick();

      return records[key] as never;
    });
    jest.spyOn(StorageUtils, 'set').mockImplementation(async (key: string, value: unknown) => {
      await tick();
      records[key] = value;
    });
    jest.spyOn(StorageUtils, 'setStore').mockImplementation(async (value: IOhMyMock) => {
      await tick();
      records[STORAGE_KEY] = value;
    });
    // `ensureGroups` reads the groups it has been given in one batch, and the
    // real `getMany` answers through a `chrome.storage.local.get` callback that
    // the stub below never calls. Left unstubbed it is not a wrong answer but a
    // promise that never settles — the import hangs at `addDomain`, and only
    // once a group exists to be read, so the first import in a suite passes and
    // the second waits for ever.
    jest.spyOn(StorageUtils, 'getMany').mockImplementation(async (keys: string[]) => {
      await tick();

      return Object.fromEntries(keys.filter(k => k in records).map(k => [k, records[k]])) as never;
    });
    jest.spyOn(StorageUtils, 'remove').mockImplementation(async (key: string | number | string[] | number[]) => {
      await tick();

      for (const k of Array.isArray(key) ? key : [key]) {
        delete records[k + ''];
      }
    });
    jest.spyOn(StorageUtils, 'reset').mockImplementation(async () => {
      await tick();
      // `chrome.storage.local.clear()`: everything, not just the store record.
      for (const key of Object.keys(records)) {
        delete records[key];
      }
    });

    // `ensureGroups` reads the whole of storage when a domain has no group yet.
    StorageUtils.chrome = {
      storage: {
        local: {
          get: jest.fn(async (keys: unknown) => (keys === null ? { ...records } : {}))
        }
      }
    } as unknown as typeof StorageUtils.chrome;

    queue = new OhMyQueue();
    wipesRunOn(queue, payloadType.RESET);

    // The real handlers, wired the way `background.ts` wires them.
    void queue.addHandler(payloadType.UPSERT, OhMyImportHandler.upsert);
    void queue.addHandler(payloadType.RESET, () => resetEverything());
  });

  afterEach(() => {
    jest.restoreAllMocks();
    StorageUtils.chrome = realChrome;
    forgetWipes();
  });

  const packet = (type: payloadType, data?: unknown): IPacket => ({
    source: 'popup',
    payload: {
      type,
      data,
      context: { domain: 'test.dev', preset: 'default', active: true },
      description: 'spec'
    }
  } as unknown as IPacket);

  /**
   * What `background.ts` does with a message off the bus, verbatim: the whole
   * packet, from queued to answered, is one unit of work held at the barrier's
   * door — and the lane goes with it, which is how the barrier knows to let a
   * reset straight through rather than hold it waiting for itself.
   */
  const deliver = <T>(type: payloadType, data?: unknown): Promise<T> =>
    notWhileWiping(() => new Promise<T>(resolve =>
      queue.addPacket(type, packet(type, data), result => resolve(result as T))), type);

  it('answers with what it stored, not merely whether it worked', async () => {
    const result = await deliver<IOhMyImportResult>(payloadType.UPSERT, backup());

    // The whole content of the import dialogs' success toast. The handler used
    // to answer `IOhMyImportStatus`, which is all the public API reads, and a
    // popup import moved onto it would have had nothing to count with.
    expect(result).toEqual({ status: ImportResultEnum.SUCCESS, requests: 2, responses: 2 });
    expect(records['req-1']).toBeDefined();
    expect((records['test.dev'] as { requests: string[] }).requests)
      .toEqual(expect.arrayContaining(['req-1', 'req-2']));
  });

  /**
   * The interleaving this whole change exists for: a reset arriving while the
   * import is halfway through writing its records.
   *
   * The import is held on a gate at its first write rather than merely being
   * slow — waiting a few turns and hoping proves nothing, because a reset that
   * ignored the barrier still takes several turns to reach the clear.
   */
  it('reports an import a reset wiped, rather than a success for records that are gone', async () => {
    let letTheImportFinish!: () => void;
    let sayTheImportHasStarted!: () => void;

    const importStarted = new Promise<void>(resolve => { sayTheImportHasStarted = resolve; });
    const held = new Promise<void>(resolve => { letTheImportFinish = resolve; });
    let gated = false;

    const write = StorageUtils.set as unknown as jest.SpyInstance;
    const passOn = write.getMockImplementation() as (key: string, value: unknown) => Promise<void>;

    write.mockImplementation(async (key: string, value: unknown) => {
      // One-shot, and on a record only this import writes: the reset's own
      // demo import runs through here too, and a gate that caught it as well
      // would deadlock the very wipe this is measuring.
      if (!gated && key === 'mock-1') {
        gated = true;
        sayTheImportHasStarted();
        await held;
      }

      await passOn(key, value);
    });

    // Occupy the lane first, and only then let the reset join it.
    const imported = deliver<IOhMyImportResult>(payloadType.UPSERT, backup());
    await importStarted;

    const resetDone = deliver<void>(payloadType.RESET);

    // A reset that ran beside the queue would be finished by now, with the
    // import's remaining writes still to come.
    await severalTicks();
    expect(StorageUtils.reset).not.toHaveBeenCalled();

    letTheImportFinish();

    const [result] = await Promise.all([imported, resetDone]);

    expect(result).toEqual({ status: ImportResultEnum.DISCARDED, requests: 0, responses: 0 });
    // And the records really are gone, which is what makes the answer true.
    expect(records['req-1']).toBeUndefined();
    expect(records['mock-1']).toBeUndefined();
    expect(records['test.dev']).toBeUndefined();
  });

  /**
   * The other side of it. A reset that has finished is not a verdict on
   * anything that comes after it: the barrier holds an import that arrives
   * during a wipe at the door and lets it through once the store is back, and
   * re-creating the domain is exactly what the user asked for by importing.
   * Calling that discarded would make the file unimportable for the rest of
   * the browser session.
   */
  it('does not call an import discarded because a reset happened earlier', async () => {
    await deliver<void>(payloadType.RESET);

    const result = await deliver<IOhMyImportResult>(payloadType.UPSERT, backup());

    expect(result).toEqual({ status: ImportResultEnum.SUCCESS, requests: 2, responses: 2 });
    expect(records['req-1']).toBeDefined();
    expect(initStorage).toHaveBeenCalled();
  });

  it('answers an unusable packet rather than leaving its sender waiting', async () => {
    // No backup to import. The sender — a page calling the public API, or an
    // import dialog — is waiting on this, and `chrome.runtime.sendMessage` has
    // no timeout.
    const result = await deliver<IOhMyImportResult>(payloadType.UPSERT);

    expect(result).toEqual({ status: ImportResultEnum.ERROR, requests: 0, responses: 0 });
  });
});
