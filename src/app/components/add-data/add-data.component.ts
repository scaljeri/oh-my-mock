import { Component, inject } from '@angular/core';
import {
  UntypedFormControl,
  UntypedFormGroup,
  Validators,
  ReactiveFormsModule
} from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { METHODS } from '@shared/constants';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { AutocompleteDropdownComponent } from '../form/autocomplete-dropdown/autocomplete-dropdown.component';
import { MatButton } from '@angular/material/button';

@Component({
  selector: 'oh-my-add-data',
  templateUrl: './add-data.component.html',
  styleUrls: ['./add-data.component.scss'],
  imports: [
    ReactiveFormsModule,
    MatFormField,
    MatLabel,
    MatInput,
    AutocompleteDropdownComponent,
    MatButton
  ]
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
