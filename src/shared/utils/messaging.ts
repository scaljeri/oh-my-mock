import { BehaviorSubject, Observable } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { appSources, packetTypes } from '../constants';
import { IPacket } from '../type';

const packetSubject = new BehaviorSubject<IPacket>(null);

window.addEventListener('message', (ev) => {
  const packet = ev.data as IPacket;

  packet?.source && packetSubject.next(packet);
});

export const stream$ = packetSubject.asObservable();

export const streamBySource$ = (source: appSources): Observable<IPacket> => {
  return stream$.pipe(tap(s => {
    // eslint-disable-next-line no-console
    console.log(s?.source);
  }), filter(packet => packet?.source && (!source || packet.source === source)));
}

export const streamByType$ = (type: packetTypes, source?: appSources): Observable<IPacket> => {
  return streamBySource$(source).pipe(filter(packet => packet.payload.type === type));
}

export const streamById$ = (id: string, source?: appSources): Observable<IPacket> => {
  return streamBySource$(source).pipe(filter(packet => packet.payload.context?.id === id));
}

export const uniqueId = (length = 10): string => {
  return [...Array(length)].map(() => (~~(Math.random() * 36)).toString(36)).join('');
}
