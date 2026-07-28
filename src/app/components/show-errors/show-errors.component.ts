import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject
} from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { githubIssueUrl } from '@shared/constants';
import { IPacketPayload } from '@shared/packet-type';

/**
 * The reasons an error packet carries, if it carries any.
 *
 * `background/error-handler.ts` builds its payload as
 * `{ packet, errors }` from `...errors: unknown[]` — a promise's rejection
 * reasons, which are `Error` objects at least as often as they are strings.
 * The dialog used to call `.split()` on each of them straight away, which
 * throws on anything that is not a string and leaves the dialog blank.
 */
function reasonsOf(data: unknown): unknown[] {
  if (
    typeof data === 'object' &&
    data !== null &&
    'errors' in data &&
    Array.isArray(data.errors)
  ) {
    return data.errors;
  }

  return [];
}

/** One rejection reason as lines of text. */
function toLines(reason: unknown): string[] {
  const text =
    reason instanceof Error
      ? (reason.stack ?? `${reason.name}: ${reason.message}`)
      : typeof reason === 'string'
        ? reason
        : JSON.stringify(reason);

  // Split on an *escaped* newline as well: a reason that has been through
  // `JSON.stringify` on its way here carries `\n` as two characters.
  return (text ?? '').split(/\\n|\n/);
}

@Component({
  standalone: false,
  selector: 'oh-my-show-errors',
  templateUrl: './show-errors.component.html',
  styleUrls: ['./show-errors.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShowErrorsComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);
  private dialogRef = inject<MatDialogRef<ShowErrorsComponent>>(MatDialogRef);
  // `MAT_DIALOG_DATA` is an `InjectionToken<any>`, so the type argument is what
  // keeps this honest — without it the migration left `errors` as `any` and the
  // `.map` below took an implicitly-typed parameter. Required, not optional:
  // `app.component.ts` always opens this with `data: this.errors`, an array.
  errors = inject<IPacketPayload[]>(MAT_DIALOG_DATA);

  url = githubIssueUrl;
  ctrl!: UntypedFormControl;

  ngOnInit(): void {
    this.errors = (this.errors ?? []).map((error) => ({
      ...error,
      data: {
        ...(typeof error.data === 'object' && error.data !== null
          ? error.data
          : {}),
        errors: reasonsOf(error.data).map(toLines)
      }
    }));

    this.ctrl = new UntypedFormControl(this.errors);
  }

  onClose(): void {
    this.dialogRef.close();
    this.cdr.detectChanges();
  }
}
