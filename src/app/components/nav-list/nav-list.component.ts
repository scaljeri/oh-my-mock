import {
  Component,
  EventEmitter,
  HostListener,
  Output
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { resetStateOptions } from '@shared/constants';
import { ResetStateOptions } from '@shared/type';
import { AppStateService } from 'src/app/services/app-state.service';
import { ResetState } from 'src/app/store/actions';
import { JsonImportComponent } from '../json-import/json-import.component';
import { ResetStateComponent } from '../reset-state/reset-state.component';

@Component({
  selector: 'app-nav-list',
  templateUrl: './nav-list.component.html',
  styleUrls: ['./nav-list.component.scss']
})
export class NavListComponent {
  @Output() navigate = new EventEmitter<void>();

  @Dispatch() stateReset = (domain?: string) => new ResetState(domain);

  constructor(
    private appStateService: AppStateService,
    public dialog: MatDialog,
    private router: Router
  ) {}

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
      .subscribe((reset: undefined | ResetStateOptions) => {
        if (reset === resetStateOptions.ALL) {
          this.stateReset();
        } else if (reset === resetStateOptions.SELF) {
          this.stateReset(this.appStateService.domain);
        }
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
