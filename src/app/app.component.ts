import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  HostListener,
  OnDestroy,
  ViewChild
} from '@angular/core';
import { IOhMyContext, IState } from '@shared/type';
import { MatDrawer, MatDrawerMode } from '@angular/material/sidenav';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { OhMyStateService } from './services/state.service';
import { OhMyState } from './services/oh-my-store';
import { AppStateService } from './services/app-state.service';
import { Subscription } from 'rxjs';
import { initializeApp } from './app.initialize';
import { StorageService } from './services/storage.service';
import { ContentService } from './services/content.service';

const VERSION = '__OH_MY_VERSION__';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements AfterViewInit, OnDestroy {
  enabled = false;
  domain: string;

  color = 'warn';
  drawerMode: MatDrawerMode = 'over';
  drawerBackdrop = true;

  page = '';
  dialogDone = false;
  isInitializing = true;
  context: IOhMyContext;
  version: string;
  showDisabled = -1;
  stateSub: Subscription;
  isUpAndRunning = false;

  @ViewChild(MatDrawer) drawer: MatDrawer;

  constructor(
    private appState: AppStateService,
    private storeService: OhMyState,
    private stateService: OhMyStateService,
    private contentService: ContentService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    public dialog: MatDialog) {
  }

  async ngAfterViewInit(): Promise<void> {
    await initializeApp(this.appState, this.stateService);
    // await this.contentService.activate();

    this.stateSub = this.stateService.state$.subscribe((state: IState) => {
      if (!state) {
        return this.isInitializing = true;
      }

      if (state.domain !== this.domain) { // Domain switch
        this.router.navigate(['/']).then(() => {
          this.cdr.detectChanges();
        });
      }

      this.context = state.context;
      this.domain = state.context.domain;
      this.version = state.version;

      this.isInitializing = false;
      this.enabled = state.aux.appActive;

      if (this.enabled) {
        this.showDisabled = 0;
      } else if (this.showDisabled === -1) {
        this.notifyDisabled();
      }
      this.cdr.detectChanges();
    });

    // send({type: payloadType.STATE, domain: 'yolo'}).then((x) => {
    //   debugger;
    // });

    // full({ x: 'from popup' }, payloadType.STATE).then(() => {
    //   console.log('done');
    // });
  }

  onEnableChange(isChecked: boolean): void {
    this.storeService.updateAux({ appActive: isChecked }, this.context);

    this.showDisabled = 0;
    this.cdr.detectChanges();
  }

  @HostListener('window:beforeunload')
  ngOnDestroy() {
    this.stateSub?.unsubscribe();
    this.contentService.deactivate();
  }

  notifyDisabled(): void {
    this.showDisabled = 1;
  }

  popupActiveToggle(isActive = true) {
    return this.storeService.updateAux({ popupActive: isActive }, this.context);
  }

  @HostListener('window:keyup.backspace')
  goBack(): void {
    const el = document.activeElement;

    if (
      !el.closest('.oh-no-backspace-nav') &&
      el.tagName.toLowerCase() !== 'input' &&
      el.getAttribute('contenteditable') !== 'true'
    ) {
      this.router.navigate(['../']);
    }
  }

  @HostListener('window:keydown.enter')
  onEnable(): void {
    this.onEnableChange(true);
  }
}
