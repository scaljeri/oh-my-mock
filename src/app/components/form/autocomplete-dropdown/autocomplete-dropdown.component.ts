import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  ViewChild,
  inject
} from '@angular/core';
import {
  ControlValueAccessor,
  UntypedFormControl,
  NgControl
} from '@angular/forms';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';

@Component({
  standalone: false,
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
export class AutocompleteDropdownComponent
  implements AfterViewInit, OnChanges, ControlValueAccessor
{
  ngControl = inject(NgControl, { self: true });
  private cdr = inject(ChangeDetectorRef);

  @Input() options!: string[];
  @Input() optionLabels: Record<string, string> = {};
  @Input() label!: string;
  @Input() showAllOnFocus = false;
  @Input() clearOnFocus = false;
  @Input() showCopy = false;
  @Input() showDelete = false;
  @Input() copyInfo: string | undefined;
  @Input() theme: 'dark' | 'light' = 'dark';

  /**
   * `copyValue` and `inputBlur` rather than `copy` and `blur`: both of those
   * are native DOM events, and an output of the same name shadows the event on
   * the host element — the host can then never be listened to for the real
   * thing, and a parent that drops the binding silently starts receiving DOM
   * events instead of the component's.
   */
  @Output() copyValue = new EventEmitter<string>();
  @Output() delete = new EventEmitter<string>();
  @Output() inputBlur = new EventEmitter<string>();
  @Output() clear = new EventEmitter<void>();

  internalValue = '';
  _ctrl!: UntypedFormControl;
  filteredMethodOptions: string[] = [];

  private onChange: (value: string) => void = () => {};
  private onTouch: () => void = () => {};

  private autoCompleteActive = false;

  @ViewChild('input') inputRef!: ElementRef;
  @ViewChild('trigger', { read: MatAutocompleteTrigger })
  trigger!: MatAutocompleteTrigger;

  constructor() {
    const ngControl = this.ngControl;

    ngControl.valueAccessor = this;
  }

  ngOnChanges(): void {
    if (this.options) {
      if (this.showAllOnFocus) {
        this.filteredMethodOptions = [...this.options].sort();
      } else {
        this.filteredMethodOptions = this.filter(
          this.ctrl.value,
          this.options
        ).sort();
      }
    }
  }

  ngAfterViewInit(): void {
    this.ctrl.valueChanges.subscribe((value: string) => {
      this.filteredMethodOptions = this.filter(value, this.options).sort();
    });
  }

  onBlur(): void {
    if (!this.autoCompleteActive) {
      this.emitChange();
    }

    this.trigger?.closePanel?.();
  }

  emitBlur(): void {
    this.inputBlur.emit(this.ctrl.value);
  }

  emitChange(): void {
    if (this.ctrl.value !== this.internalValue) {
      this.internalValue = this.ctrl.value;
      this.onChange(this.ctrl.value);
      // `ControlValueAccessor.registerOnTouched` hands over a zero-argument
      // callback; the value it used to be called with was thrown away.
      this.onTouch();
    }

    this.emitBlur();
  }

  onAutoCompleteOpened(): void {
    this.autoCompleteActive = true;
  }

  onAutoCompleteClose(): void {
    this.emitChange();
  }

  onOptionSelected(): void {
    this.inputRef.nativeElement.blur();
  }

  onClickEdit(event: MouseEvent): void {
    event.stopPropagation();
    this.copyValue.emit(this.ctrl.value);
  }

  onClickDelete(): void {
    this.delete.emit(this.ctrl.value);
  }

  // A control can be reset to `null`, and `focus()` below reads the length of
  // whatever is stored here.
  writeValue(value: string | null) {
    this.internalValue = value ?? '';
    this.ctrl.setValue(this.internalValue, { emitEvent: false });

    if (this.showAllOnFocus) {
      this.filteredMethodOptions = [...this.options].sort();
    } else {
      this.filteredMethodOptions = this.filter(
        this.ctrl.value,
        this.options
      ).sort();
    }

    setTimeout(() => {
      this.cdr.detectChanges();
    });
  }

  registerOnChange(fn: (value: string) => void) {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void) {
    this.onTouch = fn;
  }

  focus(): void {
    this.inputRef.nativeElement.focus();

    // Move catet to the end of the input text
    const strLength = this.internalValue.length;
    this.inputRef.nativeElement.setSelectionRange(strLength, strLength);
  }

  onFocus(): void {
    if (this.clearOnFocus && !this.autoCompleteActive) {
      this.ctrl.setValue('');
    } else if (this.showAllOnFocus) {
      this.filteredMethodOptions = [...this.options].sort();
    }
  }

  onClear(event: MouseEvent): void {
    event.stopPropagation();

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
    const matchedOptions = options.filter((option) =>
      option.toLowerCase().includes(filterValue)
    );

    // If there are no options, the autocomplete dropdown closes without an close event
    if (!matchedOptions.length) {
      this.autoCompleteActive = false;
    }

    return matchedOptions;
  }

  get ctrl(): UntypedFormControl {
    if (!this._ctrl) {
      this._ctrl = new UntypedFormControl(this.internalValue);
    }

    return this._ctrl;
  }
}
