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
import { IState } from '../shared/type';
import { Select, Store } from '@ngxs/store';
import { OhMyState } from './store/state';
import { Observable } from 'rxjs';
import { MatDrawer, MatDrawerMode } from '@angular/material/sidenav';
import { ContentService } from './services/content.service';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { DisabledEnabledComponent } from './components/disabled-enabled/disabled-enabled.component';
import { Router } from '@angular/router';
import { AppStateService } from './services/app-state.service';
import { APP_VERSION } from './tokens';
import { filter } from 'rxjs/operators';

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

  page = '';
  dialogDone = false;
  isInitializing = true;

  @Dispatch() activate = (value: boolean) => new Aux({ appActive: value });
  @Select(OhMyState.mainState) state$: Observable<IState>;

  @ViewChild(MatDrawer) drawer: MatDrawer;

  private dialogRef: MatDialogRef<DisabledEnabledComponent, boolean>;
  // animals$: Observable<any>;
  constructor(
    private appStateService: AppStateService,
    private contentService: ContentService,
    private router: Router,
    public dialog: MatDialog,
    public store: Store,
    @Inject(APP_VERSION) public version: string
  ) {
    // this.version = this.appStateService.version;

    // this.animals$ = this.store.select(state => {
    //   return state;
    // });
    // this.animals$.subscribe(x => {

    //   debugger;
    // })
    this.appStateService.domain$.subscribe(domain => this.domain = domain);
  }

  async ngAfterViewInit(): Promise<void> {
    this.state$.pipe(filter(state => !!state)).subscribe((state: IState) => {
      // setTimeout(() => this.domain = this.appStateService.domain);
      // if (!state || !state.domain) {
      //   return;
      // }

      this.isInitializing = false;
      this.enabled = state.aux.appActive;

      if (this.enabled) {
        if (this.dialogRef) {
          this.dialogRef.close();
        }
        // this.contentService.sendActiveState(true);
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
