import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { resetStateOptions } from '@shared/constants';
import { IOhMyContext, ResetStateOptions } from '@shared/type';
import { OhMyState } from '../../services/oh-my-store';
import { JsonImportComponent } from '../json-import/json-import.component';
import { ResetStateComponent } from '../reset-state/reset-state.component';

/**
 * The app-wide actions: reset, state explorer, JSON import/export and the
 * external links.
 *
 * These used to be the entire sidebar. The sidebar is the domain list now
 * (`oh-my-domain-sidebar`), so this became the overflow menu in its footer —
 * the same actions behind one button, nothing dropped.
 */
@Component({
  standalone: false,
  selector: 'oh-my-nav-list',
  templateUrl: './nav-list.component.html',
  styleUrls: ['./nav-list.component.scss']
})
export class NavListComponent {
  private storeService = inject(OhMyState);
  private router = inject(Router);
  dialog = inject(MatDialog);

  @Input() context!: IOhMyContext;
  /** Emitted when an action was picked, so the shell can react if it wants. */
  @Output() navigate = new EventEmitter<void>();

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

        // Now we need to tell the content script that the popup (thats us) is still active!!
        await this.storeService.updateStore({ popupActive: true });
        await this.storeService.updateAux(
          {
            filterKeywords: '',
            filteredRequests: undefined,
            filterOptions: undefined
          },
          this.context
        );
        this.router.navigate(['/']);
        window.location.reload();
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
