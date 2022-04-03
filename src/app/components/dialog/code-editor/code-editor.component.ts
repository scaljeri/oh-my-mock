import { Component, Inject, OnInit, Optional } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { IMarker, IOhMyCodeEditOptions } from '../../form/code-edit/code-edit';

@Component({
  templateUrl: './code-editor.component.html',
  styleUrls: ['./code-editor.component.scss']
})
export class DialogCodeEditorComponent implements OnInit {
  type: string;
  base: string;
  ctrl = new FormControl();
  errors: IMarker[];
  showErrors: boolean;

  constructor(
    @Optional() private dialogRef: MatDialogRef<DialogCodeEditorComponent>,
    @Optional() @Inject(MAT_DIALOG_DATA) public input: IOhMyCodeEditOptions) { }

  ngOnInit(): void {
    this.ctrl.setValue(this.input?.code, { emitEvent: false });
    this.base = this.input?.base;
  }

  onErrors(errors: IMarker[]): void {
    this.errors = errors;
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    if (this.errors?.length > 0) { // we have errors
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
      this.base = null;
    } else {
      this.base = this.input.code as string;
    }
  }

  onReset(): void {
    this.ctrl.setValue(this.input.code);
  }
}
