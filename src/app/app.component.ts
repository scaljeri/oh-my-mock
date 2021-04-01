import {
  AfterViewInit,
  Component,
  HostListener,
  OnDestroy,
  ViewChild
} from '@angular/core';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';

import { EnableDomain } from './store/actions';
import { IState } from '../shared/type';
import { Select } from '@ngxs/store';
import { OhMyState } from './store/state';
import { Observable } from 'rxjs';
import { ThemePalette } from '@angular/material/core';
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

  color: ThemePalette = 'warn';
  drawerMode: MatDrawerMode = 'over';
  dawerBackdrop = true;
  page = '';

  @Dispatch() activate = (enabled: boolean) => new EnableDomain(enabled);
  @Select(OhMyState.mainState) state$: Observable<IState>;

  @ViewChild(MatDrawer) drawer: MatDrawer;

  private dialogRef: MatDialogRef<DisabledEnabledComponent, boolean>;

  constructor(
    private appStateService: AppStateService,
    private contentService: ContentService,
    private router: Router,
    public dialog: MatDialog
  ) { }

  async ngAfterViewInit(): Promise<void> {
    this.state$.subscribe((state: IState) => {
      if (!state) {
        return;
      }

      this.enabled = state.enabled;
      this.domain = this.appStateService.domain;

      if (this.enabled) {
        if (this.dialogRef) {
          this.dialogRef.close();
        }
      } else if (!this.dialogRef) {
        this.notifyDisabled();
      }
    });
  }

  onEnableChange({ checked }: MatSlideToggleChange): void {
    this.activate(checked);
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
        this.activate(enable);
      }
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
}
