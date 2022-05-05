import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  HostListener,
  OnDestroy,
  ViewChild
} from '@angular/core';
import { IMock, IOhMyContext, IState } from '@shared/type';
import { MatDrawer, MatDrawerMode } from '@angular/material/sidenav';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { OhMyStateService } from './services/state.service';
import { OhMyState } from './services/oh-my-store';
import { AppStateService } from './services/app-state.service';
import { Subscription } from 'rxjs';
import { initializeApp } from './app.initialize';
import { ContentService } from './services/content.service';
import { ShowErrorsComponent } from './components/show-errors/show-errors.component';
import { IPacketPayload } from '@shared/packet-type';
import { WebWorkerService } from './services/web-worker.service';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { registerIcons } from './app-icons';

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
  mockSub: Subscription;
  isUpAndRunning = false;
  errors: IPacketPayload[] = [];

  @ViewChild(MatDrawer) drawer: MatDrawer;

  constructor(
    private appState: AppStateService,
    private storeService: OhMyState,
    private stateService: OhMyStateService,
    private contentService: ContentService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private webWorkerService: WebWorkerService,
    private cdr: ChangeDetectorRef,
    public dialog: MatDialog,
    domSanitizer: DomSanitizer,
    matIconRegistry: MatIconRegistry) {
    registerIcons(matIconRegistry, domSanitizer);
  }

  async ngAfterViewInit(): Promise<void> {
    await initializeApp(this.appState, this.stateService, this.webWorkerService);
    // await this.contentService.activate();

    this.stateSub = this.stateService.state$.subscribe((state: IState) => {
      if (!state) {
        return this.isInitializing = true;
      }

      // Move to somewhere else
      if (state.domain !== this.domain && this.domain) { // Domain switch
        state.aux.popupActive = true;
        // this.storeService.updateAux({ popupActive: false }, { domain: this.domain });
        // this.storeService.updateAux({ popupActive: true }, { domain: state.domain });

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

    this.appState.errors$.subscribe(error => {
      this.errors.push(error);
      this.cdr.detectChanges();
    });
  }

  onEnableChange(isChecked: boolean): void {
    this.storeService.updateAux({ appActive: isChecked }, this.context);

    this.showDisabled = 0;
    this.cdr.detectChanges();
  }

  @HostListener('window:beforeunload')
  ngOnDestroy() {
    this.stateSub?.unsubscribe();
    this.mockSub?.unsubscribe();
    this.contentService.deactivate(true);
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

  onErrors(): void {
    const dialogRef = this.dialog.open(ShowErrorsComponent, {
      width: '90%',
      height: '90%',
      data: this.errors
    });

    dialogRef.afterClosed().subscribe(async () => {
      this.errors = [];
    });
  }
}
