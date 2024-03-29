import { Inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { filter, map, Observable, Subject, take } from 'rxjs';
import { IMock, IOhMyAPIRequest, IOhMyMockResponse } from '@shared/type';
import { OhMyStateService } from './state.service';
import { StateUtils } from '@shared/utils/state';
import { DataUtils } from '@shared/utils/data';
import { StorageService } from './storage.service';
import { IOhMyReadyResponse } from '@shared/packet-type';
import { MOCK_JS_CODE } from '@shared/constants';

interface IOhSandboxOutput {
  id: string;
  output: IOhMyMockResponse;
}

@Injectable({
  providedIn: 'root'
})
export class SandboxService {
  static StateUtils = StateUtils;
  static DataUtils = DataUtils;

  private iframe: HTMLIFrameElement;
  private outputSubject = new Subject<IOhSandboxOutput>();


  constructor(
    private stateService: OhMyStateService,
    private storageService: StorageService,
    @Inject(DOCUMENT) private document: Document) {
    this.iframe = document.getElementById('sandbox') as HTMLIFrameElement;

    window.addEventListener('message', (event) => {
      this.outputSubject.next(event.data as IOhSandboxOutput);
    })
  }

  async dispatch(input: IOhMyReadyResponse): Promise<IOhMyMockResponse> {
    const data = SandboxService.StateUtils.findRequest(this.stateService.state, input.request);
    const mockid = SandboxService.DataUtils.activeMock(data, this.stateService.state.context);
    const mock = await this.storageService.get<IMock>(mockid);

    this.iframe.contentWindow.postMessage({ ...input, mock }, '*');

    return new Promise(resolve => {
      this.outputSubject.pipe(
        take(1),
        // filter(data => data.id === mock.id),
        // map TODO
      ).subscribe((result: IOhSandboxOutput) => {
        resolve(result.output);
      })
    })
  }
}
