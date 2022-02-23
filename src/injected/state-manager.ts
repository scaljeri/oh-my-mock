import { BehaviorSubject } from 'rxjs';
import { appSources, ohMyMockStatus, payloadType, STORAGE_KEY } from '../shared/constants';
import { IOhMessage, IOhMyReadyResponse, IPacket } from '../shared/packet-type';
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

console.log('SETUP LISTENER INJECTED FOR PRE');
mb.streamByType$<IOhMyReadyResponse>(payloadType.RESPONSE, appSources.CONTENT).subscribe(({ packet }: IOhMessage<IOhMyReadyResponse>) => {
  // state = packet.payload.data as IState;
  // update.next(state);
  // INJECTED SCRIPT: state-manger.ts
  console.log('----------------------------------------', packet)
  if (packet.payload.data.response.status === ohMyMockStatus.OK) {
    console.log('PRE_RESPONSE', packet.payload);
    window[STORAGE_KEY].cache.push(packet.payload.data);
  }
});

export const ohMyState$ = update.asObservable();

export const ohMyState = (): IState => {
  return state;
}
