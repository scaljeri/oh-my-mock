import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output
} from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { resetStateOptions } from '@shared/constants';
import { IOhMyContext, ResetStateOptions } from '@shared/type';
import { OhMyState } from 'src/app/services/oh-my-store';
import { JsonImportComponent } from '../json-import/json-import.component';
import { ResetStateComponent } from '../reset-state/reset-state.component';

@Component({
  selector: 'app-nav-list',
  templateUrl: './nav-list.component.html',
  styleUrls: ['./nav-list.component.scss']
})
export class NavListComponent {
  @Input() context: IOhMyContext;
  @Output() navigate = new EventEmitter<void>();

  // @Dispatch() stateReset = (domain?: string) => new ResetState(domain, { domain: this.appStateService.domain});

  constructor(
    private storeService: OhMyState,
    private router: Router,
    public dialog: MatDialog,
  ) { }

  @HostListener('click')
  closeDrawer(): void {
    this.navigate.emit();
  }

  onReset(): void {
    const dialogRef = this.dialog.open(ResetStateComponent, {
      width: '40%',
      data: {}
    });

    dialogRef
      .afterClosed()
      .subscribe(async (reset: undefined | ResetStateOptions) => {
        if (reset === resetStateOptions.ALL) {
          await this.storeService.reset();
        } else if (reset === resetStateOptions.SELF) {
          await this.storeService.reset(this.context);
        }

        this.router.navigate(['/'])
        .then(() => {
          window.location.reload();
        });
      });

    this.navigate.emit();
  }

  onJsonImport(): void {
    this.dialog.open(JsonImportComponent, {
      width: '40%',
      data: {}
    });

    this.navigate.emit();
  }
}
