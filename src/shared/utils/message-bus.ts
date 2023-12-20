import { Observable, Subject } from 'rxjs';
import { filter, share } from 'rxjs/operators';
import { appSources, payloadType } from '../constants';
import { IOhMessage, ohMessage } from '../packet-type';
import { IOhMyContext } from '../types';

export class OhMyMessageBus {
  private readonly packetSubject = new Subject<IOhMessage<unknown, IOhMyContext>>();
  private readonly stream$ = this.packetSubject.asObservable();
  private offs: (() => void)[] = [];

  constructor() { }

  setTrigger(receiver: (cb: ohMessage) => () => void): OhMyMessageBus {
    if (receiver) {
      this.offs.push(receiver(
        (message: IOhMessage) => {
          this.emitPacket(message);

          return !!message?.callback;
        }));
    }

    return this;
  }

  clear(): void {
    this.offs.forEach(off => off());
    this.offs = [];
  }

  emitPacket(message: IOhMessage) {
    message?.packet?.source && this.packetSubject.next(message);
  }

  streamBySource$<T = unknown, X = IOhMyContext>(source: appSources | appSources[]): Observable<IOhMessage<T, X>> {
    if (source && !Array.isArray(source)) {
      source = [source];
    }

    return (this.stream$ as unknown as Observable<IOhMessage<T, X>>).pipe(
      filter((message: IOhMessage<T, X>) => {
        return message?.packet?.source && (!source || source.includes(message.packet.source))
      }),
      share()
    ) as Observable<IOhMessage<T, X>>;
  }

  streamByType$<T = unknown, X = IOhMyContext>(type: payloadType | payloadType[], source: appSources | appSources[]): Observable<IOhMessage<T, X>> {
    if (!Array.isArray(type)) {
      type = [type];
    }
    return this.streamBySource$(source).pipe(
      filter(message => {
        return type.includes(message.packet.payload.type)
      })) as Observable<IOhMessage<T, X>>;
  }

  streamById$<T = unknown, X = IOhMyContext>(id: string, source: appSources): Observable<IOhMessage<T, X>> {
    return this.streamBySource$(source).pipe(
      filter(message => message.packet.payload.context?.id === id)) as Observable<IOhMessage<T, X>>;
  }
}
