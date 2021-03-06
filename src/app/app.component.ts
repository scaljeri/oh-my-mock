import { AfterViewInit, ChangeDetectorRef, Component, HostListener, ViewChild } from '@angular/core';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';

import { EnableDomain, InitGlobalState, InitState } from './store/actions';
import { StorageService } from './services/storage.service';
import { IOhMyMock, IState, IStore } from '../shared/type';
import { Select } from '@ngxs/store';
import { OhMyState } from './store/state';
import { Observable } from 'rxjs';
import { ThemePalette } from '@angular/material/core';
import { ActivatedRoute, ActivationStart, Event as NavigationEvent, Router } from '@angular/router';
import { MatDrawer } from '@angular/material/sidenav';
import { ContentService } from './services/content.service';
import { STORAGE_KEY } from '@shared/constants';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements AfterViewInit {
  state: IState;
  color: ThemePalette = 'warn';
  drawerMode = 'over';
  dawerBackdrop = true;
  page = '';
  domain: string;

  @Dispatch() activate = (enabled: boolean) => new EnableDomain(enabled);
  @Dispatch() initState = (state: IOhMyMock) => new InitGlobalState(state);
  @Select(OhMyState.getActiveState) state$: Observable<IState>;

  @ViewChild('dawer') drawer: MatDrawer;

  constructor(
    private contentService: ContentService,
    private storageService: StorageService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private cdr: ChangeDetectorRef) {
  }

  async ngAfterViewInit(): Promise<void> {
    const globalState = await this.storageService.initialize();

    // this.state = OhMyState.getActiveState(globalState);
    this.domain = this.storageService.domain;
    this.initState(globalState);

    this.storageService.monitorStateChanges();

    this.state$.subscribe((state: IState) => {
      this.state = state;
    });

    // Some logic used to show the correct header button
    this.router.events
      .subscribe(
        (event: NavigationEvent) => {
          if (event instanceof ActivationStart) {
            this.page = event.snapshot.url[0]?.path || '/';
          }
        });
    this.page = (this.router.url.match(/^\/([^/]+)/) || [])[1] || '/';
  }

  onEnableChange({ checked }: MatSlideToggleChange): void {
    this.activate(checked);
  }

  @HostListener('window:keyup.backspace')
  goBack(): void {
    const el = document.activeElement;

    if (el.tagName.toLowerCase() !== 'input' && el.getAttribute('contenteditable') !== 'true') {
      this.router.navigate(['../']);
    }
  }
}
