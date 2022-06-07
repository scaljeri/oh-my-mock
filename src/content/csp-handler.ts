// import { combineLatest, filter, Subject } from "rxjs";
// import { appSources, payloadType } from "../shared/constants";
// import { OhMyMessageBus } from "../shared/utils/message-bus";
// import { OhMyContentState } from "./content-state";
// import { error } from "./utils";
// const cspSubject = new Subject();
// const cspRemovalSubject = new Subject();

// function cspListener(event) {
//   // error(`blockedURI:', event.blockedURI);
//   // console.log('violatedDirective', event.violatedDirective);
//   // console.log('originalPolicy', event.originalPolicy);
// console.log('CSO ERRORRRRRRRR', event);
//   cspSubject.next(true);
// }


// export function handleCSP(ms: OhMyMessageBus, contentState: OhMyContentState) {
//   document.addEventListener("securitypolicyviolation", cspListener);

//   ms.streamByType$<boolean>(payloadType.CSP_REMOVAL_ACTIVATED, appSources.BACKGROUND).subscribe(() => {
//     cspRemovalSubject.next(true);
//   });

//   ms.streamByType$<boolean>(payloadType.READY, appSources.PRE_INJECTED).subscribe(() => {
//     contentState.isReloaded = false;
//     subscription.unsubscribe();
//   });

//   const subscription = combineLatest([cspSubject, cspRemovalSubject]).pipe(
//     filter(([a, b]) => !!a && !!b),
//     filter(() => contentState.isActive())
//   ).subscribe(() => {
//     debugger;
//     if (contentState.isReloaded) {
//       error('Could not remove Content-Security-Policy!');
//       contentState.isReloaded = false;

//     } else {
//       error('CSP issues detected, this page will be reloaded so CSP headers can be removed!');
//       contentState.isReloaded = true;

//       setTimeout(() => {
//         window.location.reload();
//       }, 200);
//     }
//   })

//   return () => {
//     document.removeEventListener('securitypolicyviolation', cspListener);
//     subscription.unsubscribe();
//   }
// }
