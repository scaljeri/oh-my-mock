import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  HostListener,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';

import { EnableDomain, InitState } from './store/actions';
import { StorageService } from './services/storage.service';
import { IOhMyMock, IState } from '../shared/type';
import { Select } from '@ngxs/store';
import { OhMyState } from './store/state';
import { Observable } from 'rxjs';
import { ThemePalette } from '@angular/material/core';
import {
  ActivationStart,
  Event as NavigationEvent,
  Router,
} from '@angular/router';
import { MatDrawer } from '@angular/material/sidenav';
import { ContentService } from './services/content.service';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { DisabledEnabledComponent } from './components/disabled-enabled/disabled-enabled.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements AfterViewInit, OnDestroy {
  state: IState;
  color: ThemePalette = 'warn';
  drawerMode = 'over';
  dawerBackdrop = true;
  page = '';
  domain: string;

  @Dispatch() activate = (enabled: boolean) => new EnableDomain(enabled);
  @Dispatch() initState = (state: IOhMyMock) => new InitState(state);
  @Select(OhMyState.getActiveState) state$: Observable<IState>;

  @ViewChild('dawer') drawer: MatDrawer;

  private dialogRef: MatDialogRef<DisabledEnabledComponent, any>;

  constructor(
    private storageService: StorageService,
    private contentService: ContentService,
    private router: Router,
    public dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ) {}

  async ngAfterViewInit(): Promise<void> {
    const globalState = await this.storageService.initialize();
    this.initState(globalState);
    this.storageService.monitorStateChanges();

    this.state$.subscribe((state: IState) => {
      this.state = state;

      if (!this.state.enabled) {
        if (this.domain !== this.state.domain) {
          this.notifyDisabled();
        }
      } else if (this.dialogRef) {
        this.dialogRef.close();
      }

      this.domain = this.state.domain;
    });

    // Some logic used to show the correct header button
    this.router.events.subscribe((event: NavigationEvent) => {
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

    if (
      el.tagName.toLowerCase() !== 'input' &&
      el.getAttribute('contenteditable') !== 'true'
    ) {
      this.router.navigate(['../']);
    }
  }

  @HostListener('window:beforeunload')
  async ngOnDestroy() {
    this.contentService.destroy();
  }

  notifyDisabled(): void {
    this.dialogRef = this.dialog.open(DisabledEnabledComponent, {
      width: '300px',
    });

    this.dialogRef.afterClosed().subscribe((enable) => {
      if (enable) {
        this.activate(enable);
      }
      this.dialogRef = null;
    });
  }
}
