import { AfterViewInit, ChangeDetectionStrategy, Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, UntypedFormControl, NG_VALUE_ACCESSOR } from '@angular/forms';

const STATUS_CODES = [
  '200', '201', '204', '304', '400', '401', '403', '404', '500', '501', '503'
];

const STATUS_CODE_LABELS = {
  '200': '200 OK',
  '201': '201 Created',
  '204': '204 No Content',
  '304': '304 Not Modified',
  '400': '400 Bad Request',
  '401': '401 Unauthorized',
  '403': '403 Forbidden',
  '404': '404 Not Found',
  '500': '500 Internal Server Error',
  '501': '501 Not Implemented',
  '503': '503 Service Unavailable'
}

@Component({
  standalone: false,
  selector: 'oh-my-status-code',
  templateUrl: './status-code.component.html',
  styleUrls: ['./status-code.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => StatusCodeComponent),
      multi: true
    },
  ]
})
export class StatusCodeComponent implements AfterViewInit, ControlValueAccessor {
  @Input() statusCode!: number;

  ctrl = new UntypedFormControl(null, { updateOn: 'blur' });
  options = STATUS_CODES;
  optionLabels = STATUS_CODE_LABELS;

  ngAfterViewInit(): void {
    // The control holds what the autocomplete put there — `'404 Not Found'`,
    // or whatever was typed — and the model is the number in front of it.
    // `writeValue` below stores it back without re-emitting, so the string is
    // the only thing this ever sees.
    this.ctrl.valueChanges.subscribe((raw: string) => {
      const value = Number(String(raw).replace(/[^\d].*$/g, ''));

      this.onChange(value);
      // `registerOnTouched` hands over a zero-argument callback; the value it
      // used to be called with was thrown away.
      this.onTouch();
      this.writeValue(value);
    });
  }

  private onChange: (value: number) => void = () => { }
  private onTouch: () => void = () => { }

  writeValue(value: number | null) {
    this.ctrl.setValue(value, { emitEvent: false });
  }

  registerOnChange(fn: (value: number) => void) {
    this.onChange = fn
  }

  registerOnTouched(fn: () => void) {
    this.onTouch = fn
  }

}
