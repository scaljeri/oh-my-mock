import { AfterViewInit, ChangeDetectionStrategy, Component, EventEmitter, forwardRef, Input, OnInit, Output } from '@angular/core';
import { ControlValueAccessor, FormControl, NG_VALIDATORS, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { BehaviorSubject, merge, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'oh-my-autocomplete-dropdown',
  templateUrl: './autocomplete-dropdown.component.html',
  styleUrls: ['./autocomplete-dropdown.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AutocompleteDropdownComponent),
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: AutocompleteDropdownComponent,
      multi: true
    }
  ]
})
export class AutocompleteDropdownComponent implements AfterViewInit, ControlValueAccessor {
  @Input() options: string[];
  @Input() label: string;
  @Input() selected: string;
  @Input() freeInput: string | boolean = true;
  @Input() formControl: FormControl;

  @Output() change = new EventEmitter<string>();
  @Output() blur = new EventEmitter<string>();

  internalValue = '';
  _ctrl: FormControl;
  lastEmitted: string;
  filteredMethodOptions$: Observable<string[]>;
  private updateSubject = new BehaviorSubject<string>('');
  private autoCompleteActive = false;

  ngAfterViewInit(): void {
    this.filteredMethodOptions$ = merge(
      this.ctrl.valueChanges,
      this.updateSubject
    ).pipe(
      // startWith(''),
      map(value => this.filter(value, this.options as string[]))
    );
  }

  ngOnChanges(): void {
    if (typeof this.freeInput === 'string') {
      this.freeInput = this.freeInput === 'true' ? true : false;
    }

    if (this.ctrl) {
      this.updateSubject.next(this.ctrl.value);
    }
  }

  onBlur(): void {
    if (!this.autoCompleteActive && this.ctrl.value !== this.internalValue) {
      this.internalValue = this.ctrl.value;
      this.writeValue(this.ctrl.value);
    }
  }

  onAutoCompleteOpened(): void {
    this.autoCompleteActive = true;
  }

  onAutoCompleteClose(): void {
    if (!this.options.includes(this.ctrl.value) && !this.freeInput) { // revert 
      this.ctrl.setValue(this.selected);
    } else {
      this.selected = this.ctrl.value;
      this.onChange(this.selected);
      this.onTouch(this.selected);
    }

    this.internalValue = this.selected;
  }

  onOptionSelected(event: MatAutocompleteSelectedEvent): void {
    this.selected = event.option.value;
    this.writeValue(event.option.value);
  }

  // 
  onChange: any = () => { }
  onTouch: any = () => { }

  // this method sets the value programmatically
  writeValue(value: any) {
    this.internalValue = value;
    this.ctrl.setValue(value);
    this.updateSubject.next(value);
  }
  // upon UI element value changes, this method gets triggered
  registerOnChange(fn: any) {
    this.onChange = fn
  }
  // upon touching the element, this method gets triggered
  registerOnTouched(fn: any) {
    this.onTouch = fn
  }

  onFocus(e, t): void {
  }

  validate({ value }: FormControl) {
    if (value === '' || value === null || value === undefined) {
      return null;
    }

    if (!this.options || this.options.length === 0) {
      return { noOptionsAvailable: true };
    } else if (!this.options.includes(value) && !this.freeInput) {
      return {
        invalid: true
      }
    }

    return null;
  }

  private filter(value: string, options: string[] = []): string[] {
    if (value === undefined || value === null || value === '') {
      return this.options;
    }

    const filterValue = value.toLowerCase();

    return options.filter(option => option.toLowerCase().includes(filterValue));
  }

  get ctrl(): FormControl {
    if (!this._ctrl) {
      this._ctrl = new FormControl(this.selected);
    }

    return this._ctrl;
  }
}
