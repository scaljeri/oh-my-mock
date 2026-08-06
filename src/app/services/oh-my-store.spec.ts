import { TestBed } from '@angular/core/testing';
import { objectTypes, payloadType, STORAGE_KEY } from '@shared/constants';
import { IData, IOhMyMock, IState } from '@shared/type';
import { OhMySendToBg } from '@shared/utils/send-to-background';
import { OhMyState } from './oh-my-store';
import { StorageService } from './storage.service';

describe('OhMyState (store service)', () => {
  let service: OhMyState;
  let patch: jest.SpyInstance;
  let full: jest.SpyInstance;
  let storage: Map<string, unknown>;

  beforeEach(() => {
    storage = new Map<string, unknown>();

    TestBed.configureTestingModule({
      providers: [
        // The real one reads `chrome.storage`, which is not there. An unseeded
        // key answers `undefined`, so `getState` still falls back to a fresh
        // state the way it does on a domain nothing has been stored for — but
        // the *store* answers with a real record on purpose. A test of what the
        // popup sends has nothing to say if the store it could have read from
        // is empty: `{ ...undefined, ...partial }` equals the partial, so a
        // read-modify-write and a plain partial are indistinguishable, and the
        // assertion passes whichever the code does.
        {
          provide: StorageService,
          useValue: {
            get: async (key: string) =>
              key === STORAGE_KEY
                ? ({
                    type: objectTypes.STORE,
                    version: '1.0.0',
                    domains: ['listed.example'],
                    groups: ['g1']
                  } as IOhMyMock)
                : storage.get(key)
          }
        }
      ]
    });

    service = TestBed.inject(OhMyState);
    patch = jest
      .spyOn(OhMySendToBg, 'patch')
      .mockImplementation(async () => ({ domain: 'other.example' }) as IState);
    // The background is what actually stores a record; here it only has to
    // hand back what it was given, which is what `cloneRequest` returns.
    full = jest
      .spyOn(OhMySendToBg, 'full')
      .mockImplementation(async (data: unknown) => data);
  });

  afterEach(() => {
    patch.mockRestore();
    full.mockRestore();
  });

  describe('updateAux', () => {
    /**
     * `OhMySendToBg.patch` defaults the packet's domain to the one the popup is
     * on. `updateAux` used to pass no context at all, so a caller working on
     * another domain — the state explorer's "Activate new" toggle — read that
     * domain's state and then wrote the change to the popup's own.
     */
    it("writes to the caller's domain, not the popup's own", async () => {
      const context = { domain: 'other.example', preset: 'default' };

      await service.updateAux({ newAutoActivate: true }, context);

      expect(patch).toHaveBeenCalledWith(
        true,
        '$.aux',
        'newAutoActivate',
        payloadType.STATE,
        { domain: 'other.example' },
        'popup;updateAux'
      );
    });

    it('sends one patch per aux key', async () => {
      const context = { domain: 'other.example', preset: 'default' };

      await service.updateAux(
        { newAutoActivate: true, blurImages: false },
        context
      );

      expect(patch).toHaveBeenCalledTimes(2);
      expect(patch).toHaveBeenLastCalledWith(
        false,
        '$.aux',
        'blurImages',
        payloadType.STATE,
        { domain: 'other.example' },
        'popup;updateAux'
      );
    });
  });

  describe('cloneRequest', () => {
    const context = { domain: 'test.dev', preset: 'default' };
    const source = (partial: Partial<IData>): IData => ({
      id: 'source',
      url: '/api/a',
      method: 'GET',
      requestType: 'XHR',
      selected: {},
      enabled: {},
      mocks: {},
      lastHit: 1_000,
      lastModified: 1_000,
      version: '1.0.0',
      type: objectTypes.REQUEST,
      ...partial
    } as IData);

    /**
     * A clone is a request nothing has called yet.
     *
     * `calledAt` came along with the rest of the spread, so the copy arrived in
     * the list announcing a last hit that belonged to the request it was copied
     * from — the very claim the field was added to stop `lastHit` making.
     */
    it('does not inherit the calledAt of the request it copies', async () => {
      storage.set('source', source({ calledAt: 987_654 }));

      const clone = await service.cloneRequest('source', context, context);

      expect(clone.calledAt).toBeUndefined();
    });

    it('does inherit lastHit, which is where the clone sits in the list', async () => {
      storage.set('source', source({ calledAt: 987_654 }));

      const clone = await service.cloneRequest('source', context, context);

      expect(clone.lastHit).toBe(1_000);
    });
  });
  /**
   * The store record belongs to the background, and the popup is in no position
   * to say what its fields should be.
   *
   * This used to read the whole store, spread the change over it and send the
   * result — a read-modify-write across two processes, with the popup's read
   * potentially minutes old. The background wrote that snapshot as the record,
   * so marking the popup open undid every domain registered and every group
   * created since, leaving those domains' requests and mocks in storage with
   * nothing listing them.
   */
  describe('updateStore', () => {
    it('sends only the fields it was given', async () => {
      const full = jest
        .spyOn(OhMySendToBg, 'full')
        .mockImplementation(async () => undefined as never);

      await service.updateStore({ popupActive: true });

      expect(full).toHaveBeenCalledWith(
        { popupActive: true },
        payloadType.STORE,
        undefined,
        'popup;updateStore'
      );

      full.mockRestore();
    });
  });
});
