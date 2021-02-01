import { ChangeDetectorRef, Component } from '@angular/core';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';

import { MockXmlHttpRequestService } from './services/mock-xml-http-request.service';
import { ContentService } from './services/content.service';
import { EnableDomain, InitState } from './store/actions';
import { StorageService } from './services/storage.service';
import { IState } from './store/type';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  isEnabled = false;
  state: IState;

  @Dispatch() activate = (enabled: boolean) => new EnableDomain(enabled);
  @Dispatch() init = (state: IState) => new InitState(state);

  constructor(
    private storageService: StorageService,
    private mockService: MockXmlHttpRequestService,
    private contentService: ContentService,
    private cdr: ChangeDetectorRef) {

  }

  async ngOnInit(): Promise<void> {
    // this.state = await this.storageService.loadState();
    // this.isEnabled = this.state.enabled;

    // this.init(this.state)

    // const resp = await this.contentService.send('state', this.state);
    // console.log(resp);

    chrome.runtime.onMessage.addListener(
      (request, sender) => {
        console.log('__received data', request);
      });

    chrome.runtime.sendMessage({
      popup: 'init msg'
    }, (response) => {
      console.log('xresponse: ', response);
    });
  }

  onEnableChange({ checked }: MatSlideToggleChange): void {
    this.activate(checked);
  }
}
