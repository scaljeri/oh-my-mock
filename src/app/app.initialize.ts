import { AppStateService } from './services/app-state.service';
import { OhMyStateService } from './services/state.service';
import { WebWorkerService } from './services/web-worker.service';

export async function initializeApp(
  appStateService: AppStateService,
  stateService: OhMyStateService,
  workerService: WebWorkerService) {
  // const params = activatedRoute.snapshot.queryParams;
  const urlParams = new URLSearchParams(window.location.search);

  // const { domain, tabId } = activatedRoute.snapshot.queryParams;

  const domain = urlParams.get('domain');
  const tabId = urlParams.get('tabId');
  const contentVersion = urlParams.get('contentVersion');
  if (domain) { // Note: on reload these params do not exist anymore!
    appStateService.tabId = Number(tabId);
    appStateService.domain = domain;
    appStateService.contentVersion = contentVersion;
  }

  await stateService.initialize(appStateService.domain).then(() => {
    workerService.init(appStateService.domain);
  })

  // TODO: Send msg to BG to start with CSP header removal!!
  // send2content(appStateService.tabId, {
  //   source: appSources.POPUP,
  //   domain: appStateService.domain,
  //   payload: {
  //     type: payloadType.RELOAD,
  //     data: true,
  //     description: 'popup:reload-content'
  //   }
  // });
}
