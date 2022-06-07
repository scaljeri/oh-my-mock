import { Component } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { METHODS } from '@shared/constants';

@Component({
  selector: 'app-add-data',
  templateUrl: './add-data.component.html',
  styleUrls: ['./add-data.component.scss']
})
export class AddDataComponent {
  formGroup = new FormGroup({
    url: new FormControl('', [Validators.required]),
    requestType: new FormControl('XHR', [Validators.required]),
    method: new FormControl('GET', [Validators.required])
  });

  public availableMethods = METHODS;

  constructor(private dialogRef: MatDialogRef<AddDataComponent>) { }

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

  get urlControl(): FormControl {
    return this.formGroup.get('url') as FormControl;
  }

  get typeControl(): FormControl {
    return this.formGroup.get('requestType') as FormControl;
  }

  get methodControl(): FormControl {
    return this.formGroup.get('method') as FormControl;
  }
}
