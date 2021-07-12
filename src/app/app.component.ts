import {
  AfterViewInit,
  Component,
  HostListener,
  OnDestroy,
  ViewChild
} from '@angular/core';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';

import { Toggle } from './store/actions';
import { IState } from '../shared/type';
import { Select } from '@ngxs/store';
import { OhMyState } from './store/state';
import { Observable } from 'rxjs';
import { MatDrawer, MatDrawerMode } from '@angular/material/sidenav';
import { ContentService } from './services/content.service';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { DisabledEnabledComponent } from './components/disabled-enabled/disabled-enabled.component';
import { Router } from '@angular/router';
import { AppStateService } from './services/app-state.service';

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
  dawerBackdrop = true;
  version: string;
  page = '';
  dialogDone = false;

  @Dispatch() activate = (value: boolean) => new Toggle({ name: 'active', value });
  @Select(OhMyState.mainState) state$: Observable<IState>;

  @ViewChild(MatDrawer) drawer: MatDrawer;

  private dialogRef: MatDialogRef<DisabledEnabledComponent, boolean>;

  constructor(
    private appStateService: AppStateService,
    private contentService: ContentService,
    private router: Router,
    public dialog: MatDialog
  ) {
    // this.version = this.appStateService.version;
    this.version = chrome.runtime.getManifest().version;
  }

  async ngAfterViewInit(): Promise<void> {
    this.state$.subscribe((state: IState) => {
      setTimeout(() => this.domain = this.appStateService.domain);

      if (!state) {
        return;
      }

      this.enabled = state.toggles.active;
      if (this.enabled) {
        if (this.dialogRef) {
          this.dialogRef.close();
        }
        this.contentService.sendActiveState(true);
      } else if (!this.dialogRef && !this.dialogDone) {
        this.notifyDisabled();
      }
    });
  }

  onEnableChange({ checked }: MatSlideToggleChange): void {
    this.activate(checked);
    this.contentService.sendActiveState(checked);
  }

  @HostListener('window:beforeunload')
  ngOnDestroy(): void {
    this.contentService.destroy();
  }

  notifyDisabled(): void {
    this.dialogRef = this.dialog.open(DisabledEnabledComponent, {
      width: '300px'
    });

    this.dialogRef.afterClosed().subscribe((enable) => {
      if (enable) {
        this.onEnableChange({ checked: enable } as any);
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
