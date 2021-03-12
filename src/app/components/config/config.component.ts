import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-config',
  templateUrl: './config.component.html',
  styleUrls: ['./config.component.scss'],
})
export class ConfigComponent implements OnInit {
  test: string;

  ngOnInit(): void {
    chrome.debugger.onEvent.addListener((source, method, params: any) => {
      //   var request = params.request;
      //   var continueParams = {
      //     requestId: params.requestId,
      //   };
      this.test = 'yesyesy';
    });
  }
}
