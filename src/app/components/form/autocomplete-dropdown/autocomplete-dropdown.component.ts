import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, Self, SimpleChanges, ViewChild } from '@angular/core';
import { ControlValueAccessor, FormControl, NgControl } from '@angular/forms';
import { MatAutocompleteSelectedEvent, MatAutocompleteTrigger } from '@angular/material/autocomplete';

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
export class AutocompleteDropdownComponent implements AfterViewInit, OnChanges, ControlValueAccessor {
  @Input() options: string[];
  @Input() label: string;
  @Input() showAllOnFocus = false;
  @Input() clearOnFocus = false;
  @Input() showCopy = false;
  @Input() showDelete = false;
  @Input() copyInfo;

  @Output() copy = new EventEmitter<string>();
  @Output() delete = new EventEmitter<string>();
  @Output() blur = new EventEmitter<string>();
  @Output() clear = new EventEmitter<void>();

  internalValue = '';
  _ctrl: FormControl;
  filteredMethodOptions: string[] = [];

  onChange: any = () => { }
  onTouch: any = () => { }

  private autoCompleteActive = false;

  @ViewChild('input') inputRef: ElementRef;
  @ViewChild('trigger', { read: MatAutocompleteTrigger }) trigger: MatAutocompleteTrigger;

  constructor(@Self() public ngControl: NgControl,
    private cdr: ChangeDetectorRef) {
    ngControl.valueAccessor = this;
  }

  ngOnChanges(): void {
    if (this.options) {
      if (this.showAllOnFocus) {
        this.filteredMethodOptions = [...this.options].sort();
      } else {
        this.filteredMethodOptions = this.filter(this.ctrl.value, this.options).sort();
      }
    }
  }

  ngAfterViewInit(): void {
    this.ctrl.valueChanges.subscribe(value => {
      this.filteredMethodOptions = this.filter(this.ctrl.value, this.options).sort();
    });
  }

  onBlur(el): void {
    if (!this.autoCompleteActive) {
      this.emitChange();
    }

    el?.closePanel?.();
  }

  emitBlur(): void {
    this.blur.emit(this.ctrl.value);
  }

  emitChange(): void {
    if (this.ctrl.value !== this.internalValue) {
      this.internalValue = this.ctrl.value;
      this.onChange(this.ctrl.value);
      this.onTouch(this.ctrl.value);
    }

    this.emitBlur();
  }

  onAutoCompleteOpened(): void {
    this.autoCompleteActive = true;
  }

  onAutoCompleteClose(): void {
    this.emitChange();
  }

  onOptionSelected(event: MatAutocompleteSelectedEvent): void {
    this.inputRef.nativeElement.blur();
  }

  onClickEdit(event): void {
    event.stopPropagation();
    this.copy.emit(this.ctrl.value);
  }

  onClickDelete(event): void {
    this.delete.emit(this.ctrl.value);
  }

  writeValue(value: any) {
    this.internalValue = value;
    this.ctrl.setValue(value, { emitEvent: false });

    if (this.showAllOnFocus) {
      this.filteredMethodOptions = [...this.options].sort();
    } else {
      this.filteredMethodOptions = this.filter(this.ctrl.value, this.options).sort();
    }

    setTimeout(() => {
      this.cdr.detectChanges();
    });
  }

  registerOnChange(fn: any) {
    this.onChange = fn
  }

  registerOnTouched(fn: any) {
    this.onTouch = fn
  }

  focus(): void {
    this.inputRef.nativeElement.focus();

    // Move catet to the end of the input text
    const strLength = this.internalValue.length;
    this.inputRef.nativeElement.setSelectionRange(strLength, strLength);
  }

  onFocus(e, t): void {
    if (this.clearOnFocus && !this.autoCompleteActive) {
      this.ctrl.setValue('');
    } else if (this.showAllOnFocus) {
      this.filteredMethodOptions = [...this.options].sort();
    }
  }

  onClear(event): void {
    event.stopPropagation()

    this.ctrl.setValue('');
    this.clear.emit();
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
