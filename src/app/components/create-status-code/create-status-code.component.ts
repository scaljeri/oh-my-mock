import { Component, Inject } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import {
  REQUIRED_MSG,
  STATUS_CODE_EXISTS_MSG,
  STATUS_CODE_INVALID_MSG
} from '@shared/constants';
// TODO: modify validator to check name + code
// import { statusCodeValidator } from '../../validators/status-code.validator';

@Component({
  selector: 'app-create-status-code',
  templateUrl: './create-status-code.component.html',
  styleUrls: ['./create-status-code.component.scss']
})
export class CreateStatusCodeComponent {
  public error: string;
  public form = new FormGroup({
    statusCode: new FormControl('', [
      Validators.required
      // statusCodeValidator(this.input.existingStatusCodes)
    ]),
    name: new FormControl(),
    clone: new FormControl('')
  })

  public requiredError = REQUIRED_MSG;
  public existsError = STATUS_CODE_EXISTS_MSG;
  public invalidError = STATUS_CODE_INVALID_MSG;


  constructor(
    private dialogRef: MatDialogRef<CreateStatusCodeComponent>,
    @Inject(MAT_DIALOG_DATA) private input: { existingStatusCodes: string[] }
  ) { }

  onSave(): void {
    this.form.markAllAsTouched();

    if (this.form.valid) {
      this.dialogRef.close(this.form.value);
    }
  }

  onClose(): void {
    this.dialogRef.close();
  }

  get codeCtrl(): FormControl {
    return this.form.get('statusCode') as FormControl;
  }

  get nameCtrl(): FormControl {
    return this.form.get('name') as FormControl;
  }

  get cloneCtrl(): FormControl {
    return this.form.get('clone') as FormControl;
  }
}
