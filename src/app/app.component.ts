import { Component } from '@angular/core';
import { MockXmlHttpRequestService } from './services/mock-xml-http-request.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'angular-chrome-extension';
  test;

  constructor(private service: MockXmlHttpRequestService) { }

  ngOnInit(): void {
    console.log('XXXXXXXXXXXX');
    // chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    //   const port = chrome.tabs.connect(tabs[0].id,{name: "channelName"});
    //   console.log(tabs)
    //   port.postMessage({ url: tabs[0].url });
    // })
  }
}
