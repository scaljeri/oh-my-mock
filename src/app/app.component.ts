import { Component } from '@angular/core';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';

import { MockXmlHttpRequestService } from './services/mock-xml-http-request.service';
import { ContentService } from './services/content.service';
import { EnableDomain } from './store/actions';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'angular-chrome-extension';

  @Dispatch() activate = (enabled: boolean) => new EnableDomain(enabled);

  constructor(private service: MockXmlHttpRequestService, private contentService: ContentService) { }

  ngOnInit(): void {
    console.log('XXXXXXXXXXXX');
    // chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    //   const port = chrome.tabs.connect(tabs[0].id,{name: "channelName"});
    //   console.log(tabs)
    //   port.postMessage({ url: tabs[0].url });
    // })
  }

  onEnableChange({ checked }: MatSlideToggleChange): void {
    this.activate(checked);

    // this.contentService.enable(checked);
  }
}
