import { AfterViewInit, ChangeDetectionStrategy, Component, Input, Self } from '@angular/core';
import { ControlValueAccessor, FormControl, NgControl } from '@angular/forms';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { BehaviorSubject, merge, Observable } from 'rxjs';
import { filter, map, startWith, tap } from 'rxjs/operators';

@Component({
  selector: 'oh-my-autocomplete-dropdown',
  templateUrl: './autocomplete-dropdown.component.html',
  styleUrls: ['./autocomplete-dropdown.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    // {
    //   provide: NG_VALUE_ACCESSOR,
    //   useExisting: forwardRef(() => AutocompleteDropdownComponent),
    //   multi: true
    // },
    // {
    //   provide: NG_VALIDATORS,
    //   useExisting: AutocompleteDropdownComponent,
    //   multi: true
    // }
  ]
})
export class AutocompleteDropdownComponent implements AfterViewInit, ControlValueAccessor {
  @Input() options: string[];
  @Input() label: string;

  internalValue = '';
  _ctrl: FormControl;
  filteredMethodOptions$: Observable<string[]>;

  private updateSubject = new BehaviorSubject<string>('');
  private autoCompleteActive = false;

  constructor(@Self() public ngControl: NgControl) {
    ngControl.valueAccessor = this;
  }

  ngAfterViewInit(): void {
    const control = this.ngControl.control;

    this.filteredMethodOptions$ = this.ctrl.valueChanges.pipe(
      tap(() => {
        if (this.ngControl.control.updateOn === 'change') {
          this.emitChange();
        }
      }),
      startWith(''),
      map(() => this.filter(this.ctrl.value, this.options as string[]))
    );
  }

  onBlur(el): void {
    if (!this.autoCompleteActive) {
      this.emitChange();
    }

    el?.closePanel?.();
  }

  emitChange(): void {
    if (this.ctrl.value !== this.internalValue) {
      this.internalValue = this.ctrl.value;
      this.onChange(this.ctrl.value);
      this.onTouch(this.ctrl.value);
    }
  }

  onAutoCompleteOpened(): void {
    this.autoCompleteActive = true;
  }

  onAutoCompleteClose(): void {
    // if (!this.options.includes(this.ctrl.value) && !this.allowFreeInput) { // revert 
    // this.ctrl.setValue(this.selected);
    // } else {
    this.emitChange();
    // }
  }

  onOptionSelected(event: MatAutocompleteSelectedEvent): void {
    // this.selected = event.option.value;
  }

  onChange: any = () => { }
  onTouch: any = () => { }

  writeValue(value: any) {
    this.internalValue = value;
    this.ctrl.setValue(value);
  }

  registerOnChange(fn: any) {
    this.onChange = fn
  }

  registerOnTouched(fn: any) {
    this.onTouch = fn
  }

  onFocus(e, t): void {
  }

  // validate({ value }: FormControl) {
  //   if (value === '' || value === null || value === undefined) {
  //     return null;
  //   }

  //   if (!this.options || this.options.length === 0) {
  //     return { noOptionsAvailable: true };
  //   } else if (!this.options.includes(value) && !this.allowFreeInput) {
  //     return {
  //       invalid: true
  //     }
  //   }

  //   return null;
  // }

  private filter(value: string, options: string[] = []): string[] {
    if (value === undefined || value === null || value === '') {
      return this.options;
    }

    const filterValue = value.toLowerCase();
    const matchedOptions = options.filter(option => option.toLowerCase().includes(filterValue));

    // If there are no options, the autocomplete dropdown closes without an close event
    if (!matchedOptions.length) {
      this.autoCompleteActive = false;
    }

    return matchedOptions;
  }

  get ctrl(): FormControl {
    if (!this._ctrl) {
      this._ctrl = new FormControl(this.internalValue);
    }

    return this._ctrl;
  }
}
