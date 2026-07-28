import { Component, OnInit, inject } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { IMarker, IOhMyCodeEditOptions } from '../../form/code-edit/code-edit';

@Component({
  standalone: false,
  templateUrl: './code-editor.component.html',
  styleUrls: ['./code-editor.component.scss']
})
export class DialogCodeEditorComponent implements OnInit {
  // Not optional — see the same note in `anonymize.component.ts`. This is only
  // ever opened through `dialog.open(DialogCodeEditorComponent, { data })`, so
  // `@Optional()` promised DI a nullability the types never admitted.
  private dialogRef = inject<MatDialogRef<DialogCodeEditorComponent>>(MatDialogRef);
  input = inject<IOhMyCodeEditOptions>(MAT_DIALOG_DATA);

  type!: string;
  base!: string;
  ctrl = new UntypedFormControl();
  errors!: IMarker[];
  showErrors!: boolean;

  ngOnInit(): void {
    this.ctrl.setValue(this.input?.code ?? '', { emitEvent: false });
    this.base = this.input?.base ?? '';
  }

  onErrors(errors: IMarker[]): void {
    this.errors = errors;
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    if (this.errors?.length > 0) {
      // we have errors
      this.showErrors = true;
    } else {
      this.done();
    }
  }

  done(): void {
    this.dialogRef.close(this.ctrl.value);
  }

  onDoneErrors(state: boolean): void {
    if (state) {
      this.done();
    }

    this.showErrors = false;
  }

  onToggle(): void {
    if (this.base) {
      this.base = '';
    } else {
      this.base = this.input.code as string;
    }
  }

  onReset(): void {
    this.ctrl.setValue(this.input.code);
  }
}
