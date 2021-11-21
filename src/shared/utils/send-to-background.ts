import { ohMyDomain } from "../type";
import { appSources, payloadType } from "../constants";
import { IOhMyPacketContext, IPacket } from "../packet-type";

// TODO: make it a class
export class OhMySendToBg {
  static source: appSources;
  static domain: ohMyDomain;

  static setContext(domain: ohMyDomain, source: appSources): void {
    OhMySendToBg.domain = domain;
    OhMySendToBg.source = source;
  }

  static send<T = unknown, U = T>(packet: IPacket<T>): Promise<U> {
    return new Promise<U>(r => {
      chrome.runtime.sendMessage(packet, (arg) => r(arg));
    });
  }

  static full<T = unknown, U = T>(
    data: T,
    type: payloadType,
    context?: IOhMyPacketContext
  ): Promise<U> {
    return OhMySendToBg.send<T, U>({
      source: OhMySendToBg.source,
      payload: {
        context: { domain: OhMySendToBg.domain, ...context },
        type,
        data
      }
    });
  }

  static patch<T = unknown, U = T>(
    data: T,
    path: string,
    propName: string,
    type: payloadType,
    context?: IOhMyPacketContext
  ): Promise<U> {
    return OhMySendToBg.send<T, U>({
      source: OhMySendToBg.source,
      payload: {
        context: { domain: OhMySendToBg.domain, ...context, path, propertyName: propName },
        type,
        data
      }
    });
  }

  static reset(key: string): Promise<string> {
    return OhMySendToBg.send({
      source: OhMySendToBg.source,
      payload: {
        type: payloadType.RESET,
        data: key
      }
    });
  }
}
