import { IPacketPayload } from "../../shared/packet-type";
import { IOhMyMock, IOhMyResponse, IOhMyDomain, IOhMyContext, IOhMyPropertyContext } from "../../shared/types";
import { OhMyQueue } from "../../shared/utils/queue";
import { StorageUtils } from "../../shared/utils/storage";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IOhMyHandler { }

export interface IOhMyHandlerConstructor<T = unknown, K = IOhMyMock | IOhMyResponse | IOhMyDomain, X = IOhMyContext> {
  new(): IOhMyHandler;
  StorageUtils: StorageUtils;
  update: (input: IPacketPayload<T, X>) => Promise<K | void>;
  queue?: OhMyQueue;
}

export function staticImplements<T>() {
  return <U extends T>(constructor: U) => { constructor };
}
