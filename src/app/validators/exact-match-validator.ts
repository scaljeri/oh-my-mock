import { AbstractControl, ValidatorFn, ValidationErrors } from '@angular/forms';

export const exactOptionMatchValidator = (options: string[]): ValidatorFn => {

    return (control: AbstractControl): ValidationErrors | null => {
        const value = control.value;

        if ([undefined, null, ''].includes(value)) {
            return null;
        }

        return options.includes(value) ? null : { noExactOptionMatch: true }
    };

};
