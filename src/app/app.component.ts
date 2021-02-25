import { ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';

import { EnableDomain, InitState, StateReset } from './store/actions';
import { StorageService } from './services/storage.service';
import { IState } from './store/type';
import { Select } from '@ngxs/store';
import { OhMyState } from './store/state';
import { Observable } from 'rxjs';
import { STORAGE_KEY } from './types';
import { ThemePalette } from '@angular/material/core';
import { ActivatedRoute, ActivationStart, Event as NavigationEvent, NavigationStart, Router } from '@angular/router';
import { MatDrawer } from '@angular/material/sidenav';
import { ContentService } from './services/content.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  isEnabled = false;
  state: IState;
  color: ThemePalette = 'warn';
  drawerMode = 'over';
  dawerBackdrop = true;
  page = '';

  @Dispatch() activate = (enabled: boolean) => new EnableDomain(enabled);
  @Dispatch() initState = (state: IState) => new InitState(state);
  @Dispatch() stateReset = () => new StateReset();
  @Select(OhMyState.getState) state$: Observable<{ OhMyState: IState }>;

  @ViewChild('drawer') drawer: MatDrawer;

  constructor(
    private contentService: ContentService,
    private storageService: StorageService,
    private router: Router,
    private cdr: ChangeDetectorRef) {
  }

  async ngOnInit(): Promise<void> {
    // this.storageService.reset();

    this.state = await this.storageService.loadState();

    console.log('RRRRRRRRRRRRRRRRRRR', this.state);
    this.initState(this.state)

    this.state$.subscribe(state => {
      this.state = state[STORAGE_KEY];
      this.isEnabled = this.state.enabled;
    });

    this.router.events
      .subscribe(
        (event: NavigationEvent) => {
          if (event instanceof ActivationStart) {
            this.page = event.snapshot.url[0]?.path || '';
          }
        });




    /*, (response) => {
      console.log('xresponse: ', response);
    }); */

    // console.log('send msg');
    // var port = chrome.runtime.connect({ name: "knockknock popup" });
    // port.postMessage({ joke: "Knock knock popup" });

    // port.onMessage.addListener(function (msg) {
    //   console.log('content script.port ', msg);
    // });
  }

  onEnableChange({ checked }: MatSlideToggleChange): void {
    this.activate(checked);
  }

  onResetAll(): void {
    this.storageService.reset();
    this.stateReset();

    if (this.drawer) {
      this.drawer.close();
    }
  }
}
