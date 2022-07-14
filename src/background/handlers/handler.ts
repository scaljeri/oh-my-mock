import { IOhMyPacketContext, IPacketPayload } from "../../shared/packet-type";
import { IOhMyMock, IOhMyResponse, IOhMyDomain } from "../../shared/type";
import { OhMyQueue } from "../../shared/utils/queue";
import { StorageUtils } from "../../shared/utils/storage";

export interface IOhMyHandler<T = unknown, K = IOhMyMock | IOhMyResponse | IOhMyDomain> {
  queue?: OhMyQueue;
  update: (input: IPacketPayload<T, IOhMyPacketContext>) => Promise<K | void>;
}

export interface IOhMyHandlerConstructor {
  new(hour: number, minute: number): IOhMyHandler;
  StorageUtils: StorageUtils;
}
