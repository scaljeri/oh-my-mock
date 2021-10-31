import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  HostListener,
  OnDestroy,
  ViewChild
} from '@angular/core';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';

import { IOhMyContext } from '../shared/type';
import { MatDrawer, MatDrawerMode } from '@angular/material/sidenav';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { DisabledEnabledComponent } from './components/disabled-enabled/disabled-enabled.component';
import { Router } from '@angular/router';
import { OhMyStateService } from './services/state.service';
import { OhMyState } from './services/oh-my-store';

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
  showDisabled = -1;

  @ViewChild(MatDrawer) drawer: MatDrawer;

  private dialogRef: MatDialogRef<DisabledEnabledComponent, boolean>;
  constructor(
    private storeService: OhMyState,
    private stateService: OhMyStateService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    public dialog: MatDialog) { }

  async ngAfterViewInit(): Promise<void> {
    this.stateService.state$.subscribe(state => {
      if (!state) {
        return this.isInitializing = true;
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
  }

  onEnableChange(isChecked: boolean): void {
    this.storeService.updateAux({ appActive: isChecked }, this.context);

    this.showDisabled = 0;
    this.cdr.detectChanges();
  }

  @HostListener('window:beforeunload')
  ngOnDestroy(): void {
    // this.popupActive(false);
  }

  notifyDisabled(): void {
    this.showDisabled = 1;
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
