import { BehaviorSubject, Observable } from 'rxjs';
import { filter, share, tap } from 'rxjs/operators';
import { appSources, payloadType } from '../constants';
import { IOhMessage, ohMessage } from '../packet-type';

export class OhMyMessageBus {
  private readonly packetSubject = new BehaviorSubject<IOhMessage<any>>(null);
  private readonly stream$ = this.packetSubject.asObservable();
  private offs = [];

  constructor() { }

  setTrigger(receiver: (cb: ohMessage) => () => void): OhMyMessageBus {
    if (receiver) {
      this.offs.push(receiver((message: IOhMessage) => {
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

  streamBySource$<T = unknown>(source: appSources | appSources[]): Observable<IOhMessage<T>> {
    if (source && !Array.isArray(source)) {
      source = [source];
    }

    return this.stream$.pipe(
      filter(message => {
        return message?.packet?.source && (!source || source.includes(message.packet.source))
      }),
      share()) as Observable<IOhMessage<T>>;
  }

  streamByType$<T = unknown>(type: payloadType | payloadType[], source?: appSources | appSources[]): Observable<IOhMessage<T>> {
    if (!Array.isArray(type)) {
      type = [type];
    }
    return this.streamBySource$(source).pipe(
      filter(message => {
        return type.includes(message.packet.payload.type)
      })) as Observable<IOhMessage<T>>;
  }

  streamById$<T = unknown>(id: string, source?: appSources): Observable<IOhMessage<T>> {
    return this.streamBySource$(source).pipe(filter(message => message.packet.payload.context?.id === id)) as Observable<IOhMessage<T>>;
  }
}
