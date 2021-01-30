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
      this.state = await this.storageService.loadState();
      console.log('Loaded state=', this.state);
      this.isEnabled = this.state.enabled;

      this.init(this.state)
      this.state = this.state;
  }

  onEnableChange({ checked }: MatSlideToggleChange): void {
    this.activate(checked);
  }
}
