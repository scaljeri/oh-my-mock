import { combineLatest, filter, Subject } from "rxjs";
import { appSources, payloadType } from "../shared/constants";
import { OhMyMessageBus } from "../shared/utils/message-bus";
import { OhMyContentState } from "./content-state";
import { error } from "./utils";
const cspSubject = new Subject();
const cspRemovalSubject = new Subject();

function cspListener(event) {
  error('CSP issues detected, OhMyMock will reload and remove CSP headers!');
  // error(`blockedURI:', event.blockedURI);
  // console.log('violatedDirective', event.violatedDirective);
  // console.log('originalPolicy', event.originalPolicy);

  cspSubject.next(true);
}

document.addEventListener("securitypolicyviolation", cspListener);

export function handleCSP(ms: OhMyMessageBus, contentState: OhMyContentState) {
  ms.streamByType$<boolean>(payloadType.CSP_REMOVAL_ACTIVATED, appSources.BACKGROUND).subscribe(() => {
    cspRemovalSubject.next(true);
  });

  ms.streamByType$<boolean>(payloadType.READY, appSources.PRE_INJECTED).subscribe(() => {
    contentState.isReloaded = false;
  });

  const subscription = combineLatest([cspSubject, cspRemovalSubject]).pipe(
    filter(([a, b]) => !!a && !!b)
  ).subscribe(() => {
    if (contentState.isReloaded) {
      error('Could not remove Content-Security-Policy!');
      contentState.isReloaded = false;
    } else {
      window.location.reload();
    }
  })

  return () => {
    document.removeEventListener('securitypolicyviolation', cspListener);
    subscription.unsubscribe();
  }
}
