import { ohMyDomain } from "../type";
import { appSources, payloadType } from "../constants";
import { IPacket } from "../packet-type";

// TODO: make it a class
export class OhMySendToBg {
  static source: appSources;
  static domain: ohMyDomain;

  static setContext(domain: ohMyDomain, source: appSources): void {
    OhMySendToBg.domain = domain;
    OhMySendToBg.source = source;
  }

  static send<T = unknown>(packet: IPacket<T>): Promise<T> {
    return new Promise<T>(r => {
      chrome.runtime.sendMessage(packet, (arg) => r(arg));
    });
  }

  static full<T = unknown>(
    data: T,
    type: payloadType
  ): Promise<T> {
    return OhMySendToBg.send({
      source: OhMySendToBg.source,
      payload: {
        context: { domain: OhMySendToBg.domain },
        type,
        data
      }
    });
  }

  static patch<T = unknown>(
    data: T,
    path: string,
    propName: string,
    type: payloadType
  ): Promise<T> {
    return OhMySendToBg.send({
      source: OhMySendToBg.source,
      payload: {
        context: { domain: OhMySendToBg.domain, path, propertyName: propName },
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
