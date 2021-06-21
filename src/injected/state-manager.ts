import { BehaviorSubject } from 'rxjs';
import { appSources, packetTypes } from '../shared/constants';
import { IPacket, IState } from '../shared/type';
import { streamByType$ } from '../shared/utils/messaging';

let state: IState;
const update = new BehaviorSubject<IState>(state);

streamByType$(packetTypes.STATE, appSources.CONTENT).subscribe((packet: IPacket) => {
  state = packet.payload.data as IState;
  update.next(state);
});

export const ohMyState$ = update.asObservable();

export const ohMyState = (): IState => {
  return state;
}
