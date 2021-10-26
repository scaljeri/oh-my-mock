import {
  AfterViewInit,
  Component,
  HostListener,
  Inject,
  OnDestroy,
  ViewChild
} from '@angular/core';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';

import { Aux } from './store/actions';
import { IOhMyContext, IState } from '../shared/type';
import { filter } from 'rxjs';
import { MatDrawer, MatDrawerMode } from '@angular/material/sidenav';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { DisabledEnabledComponent } from './components/disabled-enabled/disabled-enabled.component';
import { Router } from '@angular/router';
import { StateStreamService } from './services/state-stream.service';

const VERSION = '__OH_MY_VERSION__';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
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

  @Dispatch() activate = (value: boolean) => new Aux({ appActive: value }, this.context);
  @Dispatch() popupActive = (value: boolean) => new Aux({ popupActive: value }, this.context);

  @ViewChild(MatDrawer) drawer: MatDrawer;

  private dialogRef: MatDialogRef<DisabledEnabledComponent, boolean>;
  constructor(
    private stateStream: StateStreamService,
    private router: Router,
    public dialog: MatDialog) { }

  async ngAfterViewInit(): Promise<void> {
    this.stateStream.state$.pipe(filter(s => !!s)).subscribe((state: IState) => {
      this.context = state.context;
      this.domain = state.context.domain;
      this.version = state.version;

      if (!state.aux.popupActive) {
        this.popupActive(true);
      }

      this.isInitializing = false;
      this.enabled = state.aux.appActive;

      if (this.enabled) {
        if (this.dialogRef) {
          this.dialogRef.close();
        }

        // TODO: update state with toggle true for active window
        // Without this informtion the content/injected scripts cannot start early mocking!!!
      } else if (!this.dialogRef && !this.dialogDone) {
        this.notifyDisabled();
      }
    });

  }

  onEnableChange({ checked }: MatSlideToggleChange): void {
    this.activate(checked);
    // this.contentService.sendActiveState(checked);
  }

  @HostListener('window:beforeunload')
  ngOnDestroy(): void {
    this.popupActive(false);
  }

  notifyDisabled(): void {
    this.dialogRef = this.dialog.open(DisabledEnabledComponent, {
      width: '300px'
    });

    this.dialogRef.afterClosed().subscribe((enable) => {
      if (enable) {
        this.onEnableChange({ checked: enable } as MatSlideToggleChange);
      }
      this.dialogDone = true;
      this.dialogRef = null;
    });
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
    this.dialogRef?.close(true);
  }
}
