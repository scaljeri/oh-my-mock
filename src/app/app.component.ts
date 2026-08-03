import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  HostListener,
  OnDestroy,
  inject
} from '@angular/core';
import { IOhMyContext, IState } from '@shared/type';
import { MatDialog } from '@angular/material/dialog';
import {
  ActivatedRoute,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet
} from '@angular/router';
import { OhMyStateService } from './services/state.service';
import { OhMyState } from './services/oh-my-store';
import { AppStateService } from './services/app-state.service';
import { Subscription } from 'rxjs';
import { initializeApp } from './app.initialize';
import { ContentService } from './services/content.service';
import { ShowErrorsComponent } from './components/show-errors/show-errors.component';
import { IPacketPayload } from '@shared/packet-type';
import { WebWorkerService } from './services/web-worker.service';
import { MatIconRegistry, MatIcon } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { registerIcons } from './app-icons';
import { NgClass } from '@angular/common';
import { CloudSyncComponent } from './components/cloud-sync/cloud-sync.component';
import { OnOffSwitchComponent } from './components/on-off-switch/on-off-switch.component';
import { DomainSidebarComponent } from './components/domain-sidebar/domain-sidebar.component';
import { TabNavComponent } from './components/tab-nav/tab-nav.component';
import { FeedbackComponent } from './components/feedback/feedback.component';
import { SpinnerComponent } from './components/spinner/spinner.component';
import { DisabledEnabledComponent } from './components/disabled-enabled/disabled-enabled.component';
import { ConnectionFailureComponent } from './components/connection-failure/connection-failure.component';

@Component({
  selector: 'oh-my-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [
    NgClass,
    MatIcon,
    RouterLink,
    RouterLinkActive,
    CloudSyncComponent,
    OnOffSwitchComponent,
    DomainSidebarComponent,
    TabNavComponent,
    RouterOutlet,
    FeedbackComponent,
    SpinnerComponent,
    DisabledEnabledComponent,
    ConnectionFailureComponent
  ]
})
export class AppComponent implements AfterViewInit, OnDestroy {
  private appState = inject(AppStateService);
  private storeService = inject(OhMyState);
  private stateService = inject(OhMyStateService);
  private contentService = inject(ContentService);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private webWorkerService = inject(WebWorkerService);
  private cdr = inject(ChangeDetectorRef);
  dialog = inject(MatDialog);

  enabled = false;
  domain!: string;

  color = 'warn';
  /**
   * The drawer: the navigation and the mock list, over the left of the page.
   *
   * Closed to start with. It was a permanent column, which spent a fixed strip
   * of a popup-sized window on something that is read occasionally and changed
   * rarely — while the api call list, the thing actually being worked with, got
   * what was left.
   */
  sidebarOpen = false;

  page = '';
  dialogDone = false;
  isInitializing = true;
  context!: IOhMyContext;
  version!: string;
  showDisabled = -1;
  stateSub!: Subscription;
  mockSub!: Subscription;
  isUpAndRunning = false;
  errors: IPacketPayload[] = [];
  // null until the first connection attempt resolves, then true/false.
  connectionFailed: boolean | null = null;

  constructor() {
    const domSanitizer = inject(DomSanitizer);
    const matIconRegistry = inject(MatIconRegistry);

    registerIcons(matIconRegistry, domSanitizer);
  }

  async ngAfterViewInit(): Promise<void> {
    await initializeApp(
      this.appState,
      this.stateService,
      this.webWorkerService
    );
    // await this.contentService.activate();

    this.stateSub = this.stateService.state$.subscribe(
      async (state: IState) => {
        if (!state) {
          return (this.isInitializing = true);
        }

        // Move to somewhere else
        if (state.domain !== this.domain && this.domain) {
          // Domain switch
          // `popupActive` is not set here. `ContentService` subscribes to the
          // same domain change and calls `activate()`, which is the one writer of
          // that flag — setting it here as well raced with it, and only ever ran
          // on a *switch*, never when the popup was first opened.
          await this.webWorkerService.init(state.domain);

          this.router.navigate(['/']).then(() => {
            this.cdr.detectChanges();
          });
        }

        this.context = state.context;
        this.domain = state.context.domain;
        this.version = state.version;

        this.isInitializing = false;
        this.enabled = state.aux.appActive ?? false;

        if (this.enabled) {
          this.showDisabled = 0;
        } else if (this.showDisabled === -1) {
          this.notifyDisabled();
        }
        this.cdr.detectChanges();
      }
    );

    this.appState.errors$.subscribe((error) => {
      this.errors.push(error);
      this.cdr.detectChanges();
    });

    this.contentService.pingPong().subscribe((isConnectedWithContent) => {
      this.connectionFailed = !isConnectedWithContent;
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
    this.contentService.deactivate();
  }

  /**
   * The "OhMyMock is disabled" prompt was closed without answering it. Only
   * the prompt goes away — the domain keeps whatever setting it had.
   */
  onDismissDisabled(): void {
    this.showDisabled = 0;
    this.cdr.detectChanges();
  }

  notifyDisabled(): void {
    this.showDisabled = 1;
  }

  @HostListener('window:keyup.backspace')
  goBack(): void {
    const el = document.activeElement;

    if (
      el &&
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

  /**
   * Navigating from the sidebar no longer has to close an overlay. The hook is
   * kept so the nav list does not need to know about the shell's layout.
   */
  /** Something in the drawer was picked, so the drawer has done its job. */
  onNavigate(): void {
    this.sidebarOpen = false;
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
