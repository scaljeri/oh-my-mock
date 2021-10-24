import { BehaviorSubject } from 'rxjs';
import { appSources, packetTypes } from '../shared/constants';
import { IPacket, IState } from '../shared/type';
import { streamByType$ } from '../shared/utils/message-bus';

let state: IState;
const update = new BehaviorSubject<IState>(state);

streamByType$(packetTypes.STATE, appSources.CONTENT).subscribe((packet: IPacket) => {
  state = packet.payload.data as IState;
  update.next(state);
});

streamByType$(packetTypes.ACTIVE, appSources.CONTENT).subscribe((packet: IPacket) => {
  // state = packet.payload.data as IState;
  // update.next(state);
  // INJECTED SCRIPT: state-manger.ts
});

export const ohMyState$ = update.asObservable();

export const ohMyState = (): IState => {
  return state;
}
