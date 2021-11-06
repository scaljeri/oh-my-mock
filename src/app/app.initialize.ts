import { AppStateService } from './services/app-state.service';
import { OhMyStateService } from './services/state.service';

export async function initializeApp(
  appStateService: AppStateService, stateService: OhMyStateService) {
  const urlParams = new URLSearchParams(window.location.search);

  const domain = urlParams.get('domain');
  const tabId = urlParams.get('tabId');

  if (domain) { // Note: on reload these params do not exist anymore!
    appStateService.domain = domain;
    appStateService.tabId = Number(tabId);
  }

  await stateService.initialize(appStateService.domain);
}
