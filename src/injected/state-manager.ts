import { BehaviorSubject, Subject } from 'rxjs';
import { appSources, payloadType } from '../shared/constants';
import { ohMyWindow } from '../shared/oh-my-window';
import { IOhMessage, IOhMyImportStatus, IOhMyReadyResponse } from '../shared/packet-type';
import { IOhMyInjectedState } from '../shared/type';
import { OhMyMessageBus } from '../shared/utils/message-bus';
import { triggerWindow } from '../shared/utils/trigger-msg-window';
import { log } from './utils';

// Undefined until the content script has sent the first STATE message.
let state: IOhMyInjectedState | undefined;

export function setupListenersMessageBus() {
  const externalApiResults = new Subject<IOhMyImportStatus>();
  const update = new BehaviorSubject<IOhMyInjectedState | undefined>(state);
  const mb = new OhMyMessageBus().setTrigger(triggerWindow);
  ohMyWindow().off?.push(() => mb.clear());

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
    const response = packet.payload.data;

    if (response) {
      ohMyWindow().cache?.push(response);
    }
  });

  mb.streamByType$<IOhMyImportStatus>(payloadType.OHMYMOCK_API_OUTPUT, appSources.CONTENT).subscribe(({ packet }: IOhMessage<IOhMyImportStatus>) => {
    const status = packet.payload.data;

    if (status) {
      externalApiResults.next(status);
    }
  });

  return {
    stateUpdate$: update.asObservable(),
    externalApiResult$: externalApiResults.asObservable()
  }
}

export const ohMyState = (): IOhMyInjectedState | undefined => {
  return state;
}
