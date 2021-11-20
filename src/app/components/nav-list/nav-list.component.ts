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
import { StorageService } from 'src/app/services/storage.service';
import { OhMyStateService } from 'src/app/services/state.service';

@Component({
  selector: 'app-nav-list',
  templateUrl: './nav-list.component.html',
  styleUrls: ['./nav-list.component.scss']
})
export class NavListComponent {
  @Input() context: IOhMyContext;
  @Output() navigate = new EventEmitter<void>();

  constructor(
    private storeService: OhMyState,
    private stateService: OhMyStateService,
    private storageService: StorageService,
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
        } else {
          return;
        }

        this.router.navigate(['/'])
          // .then(() => {
            // TODO: Remove reload, it causes issues with state :(
            // This is a hack, just to make sure that the state has been updated before reload
            // this.stateService.state = await this.storageService.get(this.context.domain);
            // window.location.reload();
          // });
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
