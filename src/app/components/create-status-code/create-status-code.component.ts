import { Component, Inject } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import {
  REQUIRED_MSG,
  STATUS_CODE_EXISTS_MSG,
  STATUS_CODE_INVALID_MSG
} from '@shared/constants';
import { statusCodeValidator } from '../../validators/status-code.validator';

@Component({
  selector: 'app-create-status-code',
  templateUrl: './create-status-code.component.html',
  styleUrls: ['./create-status-code.component.scss']
})
export class CreateStatusCodeComponent {
  public error: string;
  public statusCodeControl = new FormControl('', [
    Validators.required,
    // Validators.min(200),
    // Validators.max(599),
    statusCodeValidator(this.input.existingStatusCodes)
  ]);
  public cloneCtrl = new FormControl('');
  public requiredError = REQUIRED_MSG;
  public existsError = STATUS_CODE_EXISTS_MSG;
  public invalidError = STATUS_CODE_INVALID_MSG;

  constructor(
    private dialogRef: MatDialogRef<CreateStatusCodeComponent>,
    @Inject(MAT_DIALOG_DATA) private input: { existingStatusCodes: string[] }
  ) {}

  onSave(): void {
    if (this.statusCodeControl.valid) {
      const clone = this.cloneCtrl.value;

      this.dialogRef.close({ statusCode: this.statusCodeControl.value, clone });
    }
  }

  onClose(): void {
    this.dialogRef.close();
  }
}
