import { BehaviorSubject } from 'rxjs';
import { appSources, payloadType } from '../shared/constants';
import { IState } from '../shared/type';
import { OhMyMessageBus } from '../shared/utils/message-bus';
import { triggerWindow } from '../shared/utils/trigger-msg-window';

let state: IState;
const update = new BehaviorSubject<IState>(state);
const mb = new OhMyMessageBus().setTrigger(triggerWindow);

mb.streamByType$(payloadType.STATE, appSources.CONTENT).subscribe(({ packet }) => {
  state = packet.payload.data as IState;
  update.next(state);
});

mb.streamByType$(payloadType.ACTIVE, appSources.CONTENT).subscribe(({ packet }) => {
  // state = packet.payload.data as IState;
  // update.next(state);
  // INJECTED SCRIPT: state-manger.ts
});

export const ohMyState$ = update.asObservable();

export const ohMyState = (): IState => {
  return state;
}
