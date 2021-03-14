import { AbstractControl, ValidatorFn, ValidationErrors } from '@angular/forms';

export const statusCodeValidator = (existingCodes: string[]): ValidatorFn => {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;

    if (value === undefined) {
      return;
    }

    if (value.match(/^\d+$/)) {
      if (existingCodes.indexOf(value) >= 0) {
        return { exists: true };
      }
    } else {
      return { invalid: true };
    }
  };
};
