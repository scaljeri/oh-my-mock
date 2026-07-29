import { Component, Input, inject } from '@angular/core';
import {
  UntypedFormControl,
  UntypedFormGroup,
  Validators,
  ReactiveFormsModule
} from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import {
  REQUIRED_MSG,
  STATUS_CODE_EXISTS_MSG,
  STATUS_CODE_INVALID_MSG
} from '@shared/constants';
import { IMock } from '@shared/types/mock';
import { ToggleComponent } from '../toggle/toggle.component';
import { STATUS_CODE_OPTIONS } from '../request/mock-details/mock-details.component';

@Component({
  selector: 'oh-my-create-status-code',
  templateUrl: './create-status-code.component.html',
  styleUrls: ['./create-status-code.component.scss'],
  imports: [ReactiveFormsModule, ToggleComponent]
})
export class CreateStatusCodeComponent {
  private dialogRef =
    inject<MatDialogRef<CreateStatusCodeComponent>>(MatDialogRef);

  @Input() mock!: IMock;

  public error!: string;
  public form = new UntypedFormGroup({
    statusCode: new UntypedFormControl('', Validators.required),
    label: new UntypedFormControl(),
    clone: new UntypedFormControl()
  });

  // The same suggestions the detail pane offers, so a code typed here and one
  // edited there come from one list.
  public statusCodeOptions = STATUS_CODE_OPTIONS;

  public requiredError = REQUIRED_MSG;
  public existsError = STATUS_CODE_EXISTS_MSG;
  public invalidError = STATUS_CODE_INVALID_MSG;

  onSave(): void {
    this.codeCtrl.setValidators([Validators.required]);
    this.form.markAllAsTouched();

    if (this.form.valid) {
      const data = {
        mock: {
          // The field accepts "404" and "404 Not Found" alike — the datalist
          // offers the labelled form — so only the digits are stored.
          statusCode: Number(String(this.form.value.statusCode).match(/\d+/)?.[0]),
          ...(this.form.value.label && { label: this.form.value.label })
        },
        clone: this.form.value.clone
      };

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
