import { BehaviorSubject, Observable } from 'rxjs';
import { filter, share } from 'rxjs/operators';
import { appSources, packetTypes } from '../constants';
import { IPacket } from '../type';

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
    filter(packet => { return packet?.source && (!source || packet.source === source) }, share()));
}

export const streamByType$ = <T = unknown>(type: packetTypes, source?: appSources): Observable<IPacket<T>> => {
  return streamBySource$(source).pipe(filter(packet => packet.payload.type === type));
}

export const streamById$ = (id: string, source?: appSources): Observable<IPacket> => {
  return streamBySource$(source).pipe(filter(packet => packet.payload.context?.id === id));
}

