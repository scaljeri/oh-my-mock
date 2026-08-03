import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogModule
} from '@angular/material/dialog';
import { IOhMyResponseCookie } from '@shared/type';

export interface IOhMyResponseCookiesData {
  /** What the response holds now. Never mutated — the dialog edits a copy. */
  cookies: IOhMyResponseCookie[];
  /** Shown so it is obvious which response is being edited. */
  statusCode?: number;
}

/**
 * The cookies a saved response sets, as a list of name/value pairs.
 *
 * A dialog rather than a fifth tab beside Body/Headers/Code: those are three
 * views of one payload and this is not part of the payload, it is a side effect
 * of delivering it. Most responses set none, so it stays out of the way until
 * the button says otherwise.
 *
 * Name and value only. `chrome.cookies` takes path, secure, sameSite and an
 * expiry as well — `IOhMyCookieAttributes` carries all of them and the
 * standalone cookie mocks let you set them — but a response cookie is being
 * written on the domain the call was made to, and every one of those has a
 * defensible default. Six fields per row for what is nearly always a session
 * token is a form nobody finishes.
 */
@Component({
  selector: 'oh-my-response-cookies',
  templateUrl: './response-cookies.component.html',
  styleUrls: ['./response-cookies.component.scss'],
  imports: [FormsModule, MatDialogModule]
})
export class ResponseCookiesComponent {
  private dialogRef =
    inject<MatDialogRef<ResponseCookiesComponent, IOhMyResponseCookie[]>>(
      MatDialogRef
    );
  private cdr = inject(ChangeDetectorRef);

  /** The working copy. Discarded wholesale unless the dialog is saved. */
  cookies: IOhMyResponseCookie[];
  statusCode?: number;

  constructor() {
    const data = inject<IOhMyResponseCookiesData>(MAT_DIALOG_DATA);

    // A copy per row, not just a new array: cancelling has to leave the stored
    // response exactly as it was, and the rows are edited in place.
    this.cookies = (data?.cookies ?? []).map((cookie) => ({ ...cookie }));
    this.statusCode = data?.statusCode;
  }

  onAdd(): void {
    this.cookies = [...this.cookies, { name: '', value: '' }];
    this.cdr.detectChanges();
  }

  onRemove(index: number): void {
    this.cookies = this.cookies.filter((_, i) => i !== index);
    this.cdr.detectChanges();
  }

  /**
   * A row with no name is not a cookie; it is a row someone added and then
   * thought better of.
   */
  isComplete(cookie: IOhMyResponseCookie): boolean {
    return cookie.name.trim() !== '';
  }

  onSave(): void {
    // Blank rows are dropped rather than rejected: the dialog is a list, and
    // leaving an empty row behind is how people stop typing, not an error.
    this.dialogRef.close(
      this.cookies
        .filter((cookie) => this.isComplete(cookie))
        .map((cookie) => ({ ...cookie, name: cookie.name.trim() }))
    );
  }

  onCancel(): void {
    this.dialogRef.close(undefined);
  }

  trackByIndex(index: number): number {
    return index;
  }
}
