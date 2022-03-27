import { BehaviorSubject } from 'rxjs';
import { appSources, payloadType, STORAGE_KEY } from '../shared/constants';
import { IOhMessage, IOhMyReadyResponse } from '../shared/packet-type';
import { IOhMyInjectedState } from '../shared/type';
import { OhMyMessageBus } from '../shared/utils/message-bus';
import { triggerWindow } from '../shared/utils/trigger-msg-window';
import { log } from './utils';

let state: IOhMyInjectedState;

export function setupListenersMessageBus() {
  const update = new BehaviorSubject<IOhMyInjectedState>(state);
  const mb = new OhMyMessageBus().setTrigger(triggerWindow);
  window[STORAGE_KEY].off.push(() => mb.clear());

  mb.streamByType$(payloadType.STATE, appSources.CONTENT).subscribe(({ packet }) => {
    state = packet.payload.data as IOhMyInjectedState;
    update.next(state);
  });

  // mb.streamByType$(payloadType.ACTIVE, appSources.CONTENT).subscribe(({ packet }) => {
  //   // state = packet.payload.data as IState;
  //   // update.next(state);
  //   // INJECTED SCRIPT: state-manger.ts
  // });

  mb.streamByType$<IOhMyReadyResponse>(payloadType.RESPONSE, appSources.CONTENT).subscribe(({ packet }: IOhMessage<IOhMyReadyResponse>) => {
    window[STORAGE_KEY].cache.push(packet.payload.data);
  });

  return update.asObservable();
}

export const ohMyState = (): IOhMyInjectedState => {
  return state;
}
