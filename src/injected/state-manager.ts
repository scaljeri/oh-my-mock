import { BehaviorSubject } from 'rxjs';
import { appSources, payloadType } from '../shared/constants';
import { IPacket } from '../shared/packet-type';
import { IState } from '../shared/type';
import { streamByType$ } from '../shared/utils/message-bus';

let state: IState;
const update = new BehaviorSubject<IState>(state);

streamByType$(payloadType.STATE, appSources.CONTENT).subscribe((packet: IPacket) => {
  state = packet.payload.data as IState;
  update.next(state);
});

streamByType$(payloadType.ACTIVE, appSources.CONTENT).subscribe((packet: IPacket) => {
  // state = packet.payload.data as IState;
  // update.next(state);
  // INJECTED SCRIPT: state-manger.ts
});

export const ohMyState$ = update.asObservable();

export const ohMyState = (): IState => {
  return state;
}
