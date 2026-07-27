import { Observable, Subject } from 'rxjs';
import { filter, share } from 'rxjs/operators';
import { appSources, payloadType } from '../constants';
import { IOhMessage, ohMessage, IOhMyPacketContext } from '../packet-type';

export class OhMyMessageBus {
  // A message bus has no "current" message, so there is nothing to seed a
  // `BehaviorSubject` with. It used to be seeded with `null` — a value every
  // consumer then had to filter out again — and, worse, a `BehaviorSubject`
  // replays its last value, so a stream subscribed to after a packet had
  // already been handled would immediately re-handle that stale packet.
  private readonly packetSubject = new Subject<IOhMessage<unknown, IOhMyPacketContext>>();
  private readonly stream$ = this.packetSubject.asObservable();
  private offs: Array<() => void> = [];

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
    // `packet` comes straight off `window.postMessage`/`chrome.runtime`, so at
    // runtime it can be anything — the optional chaining is a real guard, not a
    // formality.
    message?.packet?.source && this.packetSubject.next(message);
  }

  streamBySource$<T = unknown, X = IOhMyPacketContext>(source?: appSources | appSources[]): Observable<IOhMessage<T, X>> {
    const sources = source === undefined ? undefined : ([] as appSources[]).concat(source);

    return this.stream$
      .pipe(
        filter(message => {
          return !!message?.packet?.source && (!sources || sources.includes(message.packet.source));
        }),
        share()) as Observable<IOhMessage<T, X>>;
  }

  streamByType$<T = unknown>(type: payloadType | payloadType[], source?: appSources | appSources[]): Observable<IOhMessage<T>> {
    const types = ([] as payloadType[]).concat(type);

    return this.streamBySource$(source).pipe(
      filter(message => {
        return types.includes(message.packet.payload.type)
      })) as Observable<IOhMessage<T>>;
  }

  streamById$<T = unknown, X = IOhMyPacketContext>(id: string, source?: appSources): Observable<IOhMessage<T, X>> {
    return this.stream$.pipe(
      filter(message => !!message?.packet?.source && (!source || message.packet.source === source)),
      filter(message => message.packet.payload.context?.id === id),
      share()) as Observable<IOhMessage<T, X>>;
  }
}
