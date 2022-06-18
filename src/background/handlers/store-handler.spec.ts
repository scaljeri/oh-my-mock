import { StorageUtils } from "../../../test/mocks/storage-utils.mock";
import { objectTypes, payloadType } from "../../shared/constants";
import { IOhMyPacketContext, IPacketPayload } from "../../shared/packet-type";
import { IOhMyMock } from "../../shared/type";
import { OhMyStoreHandler } from "./store-handler"

describe('BG: Store handler', () => {
  let store: IOhMyMock;
  let packet: IPacketPayload<IOhMyMock | boolean, IOhMyPacketContext>;

  beforeEach(() => {
    OhMyStoreHandler.StorageUtils = StorageUtils as any;
    store = {
      domains: ['a', 'b'],
      version: '1.0.1',
      type: objectTypes.STORE,
      popupActive: true
    };
    packet = {
      type: payloadType.STORE,
      data: store,
      description: 'test:store'
    };
    StorageUtils.setStore = jest.fn().mockResolvedValue(10);
    StorageUtils.get = jest.fn().mockResolvedValue(store);
  });

  it('should do a full update without a context', async () => {
    const output = await OhMyStoreHandler.update(packet);

    expect(output).toEqual(store);
  });

  it('should do a full update with a context', async () => {
    packet.context = {
      domain: 'xyz',
    }
    packet.data = { ...store, version: 'new' };
    const output = await OhMyStoreHandler.update(packet);

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

    const output = await OhMyStoreHandler.update(packet);

    expect(output).toEqual(store);
  });

  // it('should throw if propertyUpdate without path', async () => {
  //   packet.context = {
  //     domain: 'x',
  //     propertyName: 'popupActive'
  //   };

  //   await expect( OhMyStoreHandler.update(packet)).rejects.toThrow('some error');
  // });
});
