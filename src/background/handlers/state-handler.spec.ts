import { StorageUtils } from "../../../test/mocks/storage-utils.mock";
import { objectTypes, payloadType } from "../../shared/constants";
import { IOhMyPacketContext, IPacketPayload } from "../../shared/packet-type";
import { IOhMyDomain, IOhMyMock } from "../../shared/type";
import { OhMyStoreHandler } from "./store-handler"

describe('BG: State handler', () => {
  let state: IOhMyDomain;
  let packet: IPacketPayload<IOhMyMock | boolean, IOhMyPacketContext>;
  let su: StorageUtils;
  let handler: OhMyStoreHandler;

  beforeEach(() => {
    state = {
      version: '1.0.1',
      type: objectTypes.DOMAIN,
    };

    su = {
      get: jest.fn().mockResolvedValue(store),
      setStore: jest.fn().mockResolvedValue(10)
    };

    OhMyStoreHandler.StorageUtils = su as any;
    packet = {
      type: payloadType.STORE,
      data: store,
      description: 'test:store'
    };

    handler = new OhMyStoreHandler();
  });

  it('should do a full update without a context', async () => {
    const output = await handler.update(packet);

    expect(output).toEqual(store);
  });

  it('should do a full update with a context', async () => {
    packet.context = {
      domain: 'xyz',
    }
    packet.data = { ...store, version: 'new' };
    const output = await handler.update(packet);

    expect(output).toEqual(packet.data);
  });


  it('should path the store', async () => {
    packet.context = {
      domain: 'x',
      path: '$',
      propertyName: 'popupActive',
      preset: 'y',
      active: false,
      id: '1'
    };
    packet.data = true;

    const output = await handler.update(packet);

    expect(output).toEqual(store);
  });

  it('should throw if propertyUpdate without path', async () => {
    packet.context = {
      domain: 'x',
      propertyName: 'popupActive'
    };

    OhMyStoreHandler.logError = jest.fn();
    await handler.update(packet)

    // await expect( handler.update(packet)).rejects.toThrow('some error');
    expect(OhMyStoreHandler.logError).toHaveBeenCalled();
  });
});
