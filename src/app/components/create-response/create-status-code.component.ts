import { Component, Input } from '@angular/core';
import { UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import {
  REQUIRED_MSG,
  STATUS_CODE_EXISTS_MSG,
  STATUS_CODE_INVALID_MSG,
} from '@shared/constants';
import { IOhMyNewResponseStatusCode, IOhMyResponse, } from '@shared/types';

@Component({
  selector: 'app-create-status-code',
  templateUrl: './create-status-code.component.html',
  styleUrls: ['./create-status-code.component.scss']
})
export class CreateStatusCodeComponent {
  @Input() mock: IOhMyResponse;

  public error: string;
  public form = new UntypedFormGroup({
    statusCode: new UntypedFormControl('', Validators.required),
    label: new UntypedFormControl(),
    clone: new UntypedFormControl()
  })

  public requiredError = REQUIRED_MSG;
  public existsError = STATUS_CODE_EXISTS_MSG;
  public invalidError = STATUS_CODE_INVALID_MSG;

  constructor(private dialogRef: MatDialogRef<CreateStatusCodeComponent>) { }

  onSave(): void {
    this.codeCtrl.setValidators([Validators.required]);
    this.form.markAllAsTouched();

    if (this.form.valid) {
      const data = {
        statusCode: this.form.value.statusCode,
        label: this.form.value.label || '',
        clone: this.form.value.clone
      } as IOhMyNewResponseStatusCode;

      this.dialogRef.close(data);
    }
  }

  onClose(): void {
    this.dialogRef.close();
  }

  get codeCtrl(): UntypedFormControl {
    return this.form.get('statusCode') as UntypedFormControl;
  }

  get labelCtrl(): UntypedFormControl {
    return this.form.get('label') as UntypedFormControl;
  }

  get cloneCtrl(): UntypedFormControl {
    return this.form.get('clone') as UntypedFormControl;
  }
}
