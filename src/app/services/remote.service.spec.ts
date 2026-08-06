import { TestBed } from '@angular/core/testing';
import { payloadType } from '@shared/constants';
import { OhMySendToBg } from '@shared/utils/send-to-background';
import { RemoteService } from './remote.service';

describe('RemoteService', () => {
  let service: RemoteService;
  let patch: jest.SpyInstance;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RemoteService);
    patch = jest
      .spyOn(OhMySendToBg, 'patch')
      .mockImplementation(async () => undefined as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * `remote` is one object on a record several processes write.
   *
   * This used to read the whole store in the popup, merge the change into it
   * and send the result — a read-modify-write spanning two processes, so
   * anything the background put on `remote` between the read and the write was
   * dropped. It was safe only because this page happens to be the single
   * writer, which is not a property anything enforced.
   *
   * A patch is applied inside `mutateStore`, against the record as it stands
   * when its turn comes, so the fields this call does not name keep what they
   * have.
   */
  describe('update', () => {
    it('patches the fields it was given, one at a time', async () => {
      await service.update({ host: 'example.test', port: 9000 });

      expect(patch).toHaveBeenCalledTimes(2);
      expect(patch).toHaveBeenCalledWith(
        'example.test',
        '$.remote',
        'host',
        payloadType.STORE,
        undefined,
        'popup;remote-update'
      );
      expect(patch).toHaveBeenCalledWith(
        9000,
        '$.remote',
        'port',
        payloadType.STORE,
        undefined,
        'popup;remote-update'
      );
    });

    /**
     * The point of patching rather than sending `remote` whole: a call that
     * only switches the target must not decide what the address is.
     */
    it('says nothing about the fields it was not given', async () => {
      await service.update({ target: 'server' });

      expect(patch).toHaveBeenCalledTimes(1);
      expect(patch.mock.calls[0][2]).toBe('target');
    });

    it('sends nothing at all when given nothing', async () => {
      await service.update({});

      expect(patch).not.toHaveBeenCalled();
    });
  });
});
