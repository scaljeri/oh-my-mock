import { objectTypes, payloadType, STORAGE_KEY } from '../shared/constants';
import { IOhMyMock, IState } from '../shared/type';
import { OhMyQueue } from '../shared/utils/queue';
import { StateUtils } from '../shared/utils/state';
import { StorageUtils } from '../shared/utils/storage';
import { initStorage } from './init';
import { resetEverything } from './reset-everything';
import { forgetWipes, notWhileWiping, wipesRunOn } from './wipe-barrier';

// The rebuild a reset ends in. Both write records, and both are exercised here
// only for *when* they run — what they write is their own suites' business.
jest.mock('./init', () => ({ initStorage: jest.fn() }));
jest.mock('../shared/utils/import-json', () => ({ importJSON: jest.fn() }));

/** A storage round trip that does not finish in the turn it started in. */
const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

/** Long enough for an unguarded reset to have wiped and rebuilt. */
const severalTicks = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await tick();
  }
};

/**
 * A full reset clears the whole of `chrome.storage.local` while every other
 * lane of the background queue is free to run: `OhMyQueue` keeps one lane per
 * `payloadType`, so STATE, REQUEST, RESPONSE, COOKIE and the rest are
 * concurrent by construction. A state, request, mock or cookie record written
 * across the wipe is left in storage with nothing listing it.
 *
 * These tests are about what happens *between* a handler's read and its write,
 * so every double resolves a turn late on purpose and every one of them
 * occupies the queue **before** the reset joins it — a fake that answers
 * synchronously, or a reset that is sent first, interleaves nothing and would
 * pass whatever the code did.
 */
describe('wipe-barrier', () => {
  let records: Record<string, unknown>;
  let queue: OhMyQueue<{ payload: unknown }>;
  const realChrome = StorageUtils.chrome;

  const store = (over: Partial<IOhMyMock> = {}): IOhMyMock => ({
    type: objectTypes.STORE,
    version: '1.0.0',
    domains: [],
    ...over
  } as IOhMyMock);

  const state = (domain: string): IState => StateUtils.init({ domain });

  beforeEach(() => {
    records = { [STORAGE_KEY]: store({ domains: ['example.com'] }) };

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
    jest.spyOn(StorageUtils, 'getMany').mockImplementation(async (keys: string[]) => {
      await tick();

      return Object.fromEntries(keys.filter(k => k in records).map(k => [k, records[k]])) as never;
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

    queue = new OhMyQueue<{ payload: unknown }>();
    wipesRunOn(queue, payloadType.RESET);

    // The real handler, wired the way `background.ts` wires it.
    void queue.addHandler(payloadType.RESET, () => resetEverything());
  });

  afterEach(() => {
    jest.restoreAllMocks();
    StorageUtils.chrome = realChrome;
    forgetWipes();
  });

  /**
   * What `background.ts` does with a message off the bus, verbatim: the whole
   * packet, from queued to answered, is one unit of work held at the barrier's
   * door. The lane goes with it, which is how the barrier knows to let a reset
   * — the wipe itself — straight through.
   */
  const deliver = (type: payloadType): Promise<void> =>
    notWhileWiping(() => new Promise<void>(resolve =>
      queue.addPacket(type, { payload: {} }, () => resolve())), type);

  it('waits for a write another lane had already decided on, and then clears it', async () => {
    let letTheStateWriteFinish!: () => void;
    let sayTheStateWriteHasStarted!: () => void;

    const halfway = new Promise<void>(resolve => { sayTheStateWriteHasStarted = resolve; });
    const held = new Promise<void>(resolve => { letTheStateWriteFinish = resolve; });

    // Stands in for `OhMyStateHandler`: a read, some awaits, a write. The pause
    // is where the real one sits while it reads the store and the domain
    // record.
    await queue.addHandler(payloadType.STATE, async () => {
      sayTheStateWriteHasStarted();
      await held;
      await StorageUtils.set('example.com', state('example.com'));
    });

    // Occupy the lane first, and only then let the reset join.
    const stateDone = deliver(payloadType.STATE);
    await halfway;

    const resetDone = deliver(payloadType.RESET);

    // A reset that ran beside the queue would be finished by now, with the
    // state write still to come.
    await severalTicks();
    expect(StorageUtils.reset).not.toHaveBeenCalled();

    letTheStateWriteFinish();
    await Promise.all([stateDone, resetDone]);

    // The state was written — and then wiped, because the reset came after it.
    // Left the other way round it survives the wipe as a record for a domain
    // the rebuilt store has never heard of.
    expect(records['example.com']).toBeUndefined();
  });

  it('holds a lane that starts during the reset until the storage is back', async () => {
    const seen: string[] = [];

    await queue.addHandler(payloadType.STATE, async () => {
      seen.push('state');
      await StorageUtils.set('example.com', state('example.com'));
    });

    (initStorage as jest.Mock).mockImplementation(async () => {
      await tick();
      seen.push('rebuild');
    });

    const resetDone = deliver(payloadType.RESET);
    const stateDone = deliver(payloadType.STATE);

    await Promise.all([resetDone, stateDone]);

    // Not the other way round: a state written between the clear and the
    // rebuild is a record the rebuild's own store write does not know about.
    expect(seen).toEqual(['rebuild', 'state']);
    expect(records['example.com']).toBeDefined();
  });

  /**
   * Handlers queue packets *at* each other and wait for them — the response
   * handler on a REQUEST packet, the request and remove handlers on a STATE
   * patch. Those inner packets must never be held at the door: the outer
   * handler keeps its lane open waiting for them, and a barrier that refused to
   * start them would wait for a lane that is waiting for the barrier.
   */
  it('lets a handler finish the packet it queued at another lane', async () => {
    let sayTheOuterHandlerHasStarted!: () => void;
    const halfway = new Promise<void>(resolve => { sayTheOuterHandlerHasStarted = resolve; });

    await queue.addHandler(payloadType.STATE, async () => {
      await StorageUtils.set('example.com', state('example.com'));
    });

    await queue.addHandler(payloadType.RESPONSE, async () => {
      sayTheOuterHandlerHasStarted();
      await tick();

      // Straight onto the queue, the way `queueRequestUpdate` does it — not
      // through `notWhileWiping`.
      await new Promise<void>(resolve =>
        queue.addPacket(payloadType.STATE, { payload: {} }, () => resolve()));
    });

    const responseDone = deliver(payloadType.RESPONSE);
    await halfway;

    const resetDone = deliver(payloadType.RESET);

    await Promise.all([responseDone, resetDone]);

    expect(StorageUtils.reset).toHaveBeenCalled();
    expect(records['example.com']).toBeUndefined();
  });

  /**
   * The cookie handler queues its state patch and returns without waiting for
   * it, so the packet outlives the unit of work that sent it: the door is empty
   * again while the patch has not even started. Quiet has to mean the queue as
   * well as the door, or the patch lands after the clear.
   *
   * The patch is held on a gate rather than merely being slow. Waiting a few
   * turns and hoping proves nothing — a reset that ignored the queue entirely
   * still takes several turns to reach `StorageUtils.reset`, so the patch won
   * that race either way and this passed with the bug in place.
   */
  it('waits for a packet a handler queued and did not wait for', async () => {
    let letTheStatePatchFinish!: () => void;
    let sayTheStatePatchHasStarted!: () => void;

    const patchStarted = new Promise<void>(resolve => { sayTheStatePatchHasStarted = resolve; });
    const held = new Promise<void>(resolve => { letTheStatePatchFinish = resolve; });

    await queue.addHandler(payloadType.STATE, async () => {
      sayTheStatePatchHasStarted();
      await held;
      await StorageUtils.set('example.com', state('example.com'));
    });

    await queue.addHandler(payloadType.COOKIE, async () => {
      queue.addPacket(payloadType.STATE, { payload: {} });
    });

    const cookieDone = deliver(payloadType.COOKIE);

    // The cookie packet is answered and off the barrier's books; its state
    // patch is only now starting.
    await cookieDone;
    await patchStarted;

    const resetDone = deliver(payloadType.RESET);

    await severalTicks();
    expect(StorageUtils.reset).not.toHaveBeenCalled();

    letTheStatePatchFinish();
    await resetDone;

    expect(records['example.com']).toBeUndefined();
  });

  it('opens the door again once the reset is done', async () => {
    await queue.addHandler(payloadType.STATE, async () => {
      await StorageUtils.set('example.com', state('example.com'));
    });

    await deliver(payloadType.RESET);
    await deliver(payloadType.STATE);

    expect(records['example.com']).toBeDefined();
  });

  it('runs two resets one after the other rather than through each other', async () => {
    const rebuilds: number[] = [];
    let n = 0;

    (initStorage as jest.Mock).mockImplementation(async () => {
      const mine = ++n;

      rebuilds.push(mine);
      await tick();
      await tick();
      rebuilds.push(mine);
    });

    await Promise.all([deliver(payloadType.RESET), deliver(payloadType.RESET)]);

    expect(rebuilds).toEqual([1, 1, 2, 2]);
  });

  it('keeps working after a reset that threw', async () => {
    (initStorage as jest.Mock).mockImplementationOnce(async () => {
      await tick();

      throw new Error('the rebuild blew up');
    });

    await deliver(payloadType.RESET);

    await queue.addHandler(payloadType.STATE, async () => {
      await StorageUtils.set('example.com', state('example.com'));
    });

    // The door has to open again, or every message for the rest of the
    // worker's life waits on a wipe that is already over.
    await deliver(payloadType.STATE);

    expect(records['example.com']).toBeDefined();
  });
});
