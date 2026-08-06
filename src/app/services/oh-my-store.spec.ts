import { TestBed } from '@angular/core/testing';
import { payloadType } from '@shared/constants';
import { IState } from '@shared/type';
import { OhMySendToBg } from '@shared/utils/send-to-background';
import { OhMyState } from './oh-my-store';
import { StorageService } from './storage.service';

describe('OhMyState (store service)', () => {
  let service: OhMyState;
  let patch: jest.SpyInstance;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        // The real one reads `chrome.storage`, which is not there; answering
        // "no stored state" makes `getState` fall back to a fresh one.
        { provide: StorageService, useValue: { get: async () => undefined } }
      ]
    });

    service = TestBed.inject(OhMyState);
    patch = jest
      .spyOn(OhMySendToBg, 'patch')
      .mockImplementation(async () => ({ domain: 'other.example' }) as IState);
  });

  afterEach(() => {
    patch.mockRestore();
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
});
