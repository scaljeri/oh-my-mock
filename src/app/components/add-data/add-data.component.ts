import { Component, inject } from '@angular/core';
import {
  UntypedFormControl,
  UntypedFormGroup,
  Validators
} from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { METHODS } from '@shared/constants';

@Component({
  standalone: false,
  selector: 'oh-my-add-data',
  templateUrl: './add-data.component.html',
  styleUrls: ['./add-data.component.scss']
})
export class AddDataComponent {
  private dialogRef = inject<MatDialogRef<AddDataComponent>>(MatDialogRef);

  formGroup = new UntypedFormGroup({
    url: new UntypedFormControl('', [Validators.required]),
    requestType: new UntypedFormControl('XHR', [Validators.required]),
    method: new UntypedFormControl('GET', [Validators.required])
  });

  public availableMethods = METHODS;

  onSave(): void {
    this.formGroup.markAsTouched();
    this.formGroup.updateValueAndValidity();

    if (this.formGroup.valid) {
      this.dialogRef.close(this.formGroup.value);
    }
  }

  onClose(): void {
    this.dialogRef.close();
  }

  get urlControl(): UntypedFormControl {
    return this.formGroup.get('url') as UntypedFormControl;
  }

  get typeControl(): UntypedFormControl {
    return this.formGroup.get('requestType') as UntypedFormControl;
  }

  get methodControl(): UntypedFormControl {
    return this.formGroup.get('method') as UntypedFormControl;
  }
}
