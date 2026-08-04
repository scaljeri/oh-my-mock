import { BehaviorSubject, Subject } from 'rxjs';
import { appSources, payloadType } from '../shared/constants';
import { ohMyWindow } from '../shared/oh-my-window';
import { IOhMessage, IOhMyImportStatus } from '../shared/packet-type';
import { IOhMyInjectedState } from '../shared/types/store';
import { OhMyMessageBus } from '../shared/utils/message-bus';
import { triggerWindow } from '../shared/utils/trigger-msg-window';

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

  // There used to be a second subscription here, pushing every RESPONSE packet
  // into `ohMy.cache`. `dispatchApiRequest` already puts the answer there — it
  // subscribes by request id, so it caches the response belonging to the
  // request the page is actually making — and `findCachedResponse` splices out
  // **one** match. So every intercepted request left a duplicate behind,
  // holding a full response body for the life of the page: megabytes on a page
  // with base64 image mocks, and a linear `find` that grew with every call the
  // page had ever made.

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
