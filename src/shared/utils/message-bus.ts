import { BehaviorSubject, Observable } from 'rxjs';
import { filter, share, tap } from 'rxjs/operators';
import { appSources, payloadType } from '../constants';
import { IPacket } from '../packet-type';

const packetSubject = new BehaviorSubject<IPacket>(null);

// Injected <-> Content
window.addEventListener('message', (ev) => {
  const packet = ev.data as IPacket;

  emitPacket(packet);
});

export const emitPacket = (packet: IPacket): void => {
  packet?.source && packetSubject.next(packet);
}

export const stream$ = packetSubject.asObservable();

export const streamBySource$ = (source: appSources): Observable<IPacket> => {
  return stream$.pipe(
    filter(packet => packet?.source && (!source || packet.source === source)), share());
}

export const streamByType$ = <T = unknown>(type: payloadType, source?: appSources): Observable<IPacket<T>> => {
  return streamBySource$(source).pipe(
    filter(packet => packet.payload.type === type)) as Observable<IPacket<T>>;
}

export const streamById$ = (id: string, source?: appSources): Observable<IPacket<any>> => {
  return streamBySource$(source).pipe(filter(packet => packet.payload.context?.id === id));
}

