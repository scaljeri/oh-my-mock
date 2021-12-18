import { ActivatedRoute } from '@angular/router';
import { AppStateService } from './services/app-state.service';
import { OhMyStateService } from './services/state.service';

export async function initializeApp(
  appStateService: AppStateService,
  stateService: OhMyStateService,
  activatedRoute: ActivatedRoute) {
  // const params = activatedRoute.snapshot.queryParams;
  const urlParams = new URLSearchParams(window.location.search);

  // const { domain, tabId } = activatedRoute.snapshot.queryParams;

  const domain = urlParams.get('domain');
  const tabId = urlParams.get('tabId');

  if (domain) { // Note: on reload these params do not exist anymore!
    appStateService.tabId = Number(tabId);
    appStateService.domain = domain;
  }

  await stateService.initialize(appStateService.domain);
}
