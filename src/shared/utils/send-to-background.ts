import { ohMyDomain } from "../types/state";
import { appSources, payloadType } from "../constants";
import { IOhMyPacketContextBase, IPacket } from "../packet-type";

// TODO: make it a class
export class OhMySendToBg {
  static source: appSources;
  static domain: ohMyDomain;

  static setContext(domain: ohMyDomain, source: appSources): void {
    this.domain = domain;
    this.source = source;
  }

  static send<T = unknown, U = T>(packet: IPacket<T>): Promise<U> {
    return new Promise<U>(r => {
      chrome.runtime.sendMessage(packet, (arg) => r(arg));
    });
  }

  static full<T = unknown, U = T>(
    data: T,
    type: payloadType,
    context?: Partial<IOhMyPacketContextBase>,
    description = ''
  ): Promise<U> {
    return OhMySendToBg.send<T, U>({
      source: OhMySendToBg.source,
      payload: {
        context: { domain: OhMySendToBg.domain, ...context },
        type,
        data,
        description
      }
    });
  }

  static patch<T = unknown, U = T>(
    data: T,
    path: string,
    propName: string,
    type: payloadType,
    context?: Partial<IOhMyPacketContextBase>,
    description = ''
  ): Promise<U> {
    return OhMySendToBg.send<T, U>({
      source: OhMySendToBg.source,
      payload: {
        context: { ...context, kind: 'patch', domain: context?.domain ?? OhMySendToBg.domain, path, propertyName: propName },
        type,
        data,
        description
      }
    });
  }

  static reset(key: string, description = ''): Promise<string> {
    return OhMySendToBg.send({
      source: OhMySendToBg.source,
      payload: {
        type: payloadType.RESET,
        data: key,
        description
      }
    });
  }
}
