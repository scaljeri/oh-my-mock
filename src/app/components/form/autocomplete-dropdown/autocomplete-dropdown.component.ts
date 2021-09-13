import { Component, EventEmitter, forwardRef, HostListener, Input, OnInit, Output } from '@angular/core';
import { ControlValueAccessor, FormControl, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

@Component({
  selector: 'oh-my-autocomplete-dropdown',
  templateUrl: './autocomplete-dropdown.component.html',
  styleUrls: ['./autocomplete-dropdown.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AutocompleteDropdownComponent),
      multi: true
    }
  ]
})
export class AutocompleteDropdownComponent implements OnInit, ControlValueAccessor {
  @Input() options: string[];
  @Input() label: string;
  @Input() selected: string;
  @Input() formControl: FormControl;

  @Output() change = new EventEmitter<string>();
  @Output() blur = new EventEmitter<string>();

  internalValue = '';
  ctrl: FormControl;
  updateTimeoutId: number;

  lastEmitted: string;
  public filteredMethodOptions$: Observable<string[]>;

  ngOnInit(): void {
    this.ctrl = new FormControl(this.selected);

    this.ctrl.valueChanges.subscribe(v => {
      console.log('custon ' + v);
    })
    this.filteredMethodOptions$ = this.ctrl.valueChanges.pipe(
      startWith(this.selected),
      map(value => this.filter(value, this.options as string[]))
    );
  }

  onInputBlur(): void {
    if (!this.options.includes(this.ctrl.value)) {
      // revert 
      this.updateTimeoutId = setTimeout(() => {
        this.ctrl.setValue(this.selected);
      }, 300);
    } else {
      this.selected = this.ctrl.value;
      this.writeValue(this.ctrl.value);
    }
  }

  onOptionSelected(event: MatAutocompleteSelectedEvent): void {
    clearTimeout(this.updateTimeoutId);

    this.selected = event.option.value;
    this.writeValue(event.option.value);
  }

  onInputChange(event): void {
  }

  private filter(value: string, options: string[]): string[] {
    if (value === undefined || value === null || value === '') {
      return this.options;
    }

    const filterValue = value.toLowerCase();

    return options.filter(option => option.toLowerCase().indexOf(filterValue) === 0);
  }

  // 
  onChange: any = () => { }
  onTouch: any = () => { }

  set value(val) {  // this value is updated by programmatic changes if( val !== undefined && this.val !== val){
    if (val !== this.internalValue) {
      this.ctrl.setValue(val);
      this.internalValue = val
      this.onChange(val)
      this.onTouch(val)
    }
  }

  // this method sets the value programmatically
  writeValue(value: any) {
    this.value = value;
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
    // e.stopPropagation();
    // setTimeout(() => {
    //   t.openPanel();

    // });
  }
}
