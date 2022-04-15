import { AfterViewInit, ChangeDetectionStrategy, Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, FormControl, NG_VALUE_ACCESSOR } from '@angular/forms';

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
  @Input() statusCode: number;

  ctrl = new FormControl(null, { updateOn: 'blur' });
  options = STATUS_CODES;
  optionLabels = STATUS_CODE_LABELS;

  ngAfterViewInit(): void {
    this.ctrl.valueChanges.pipe(
    ).subscribe(value => {
      value = Number(value.replace(/[^\d].*$/g, ''));

      this.onChange(value);
      this.onTouch(value);
      this.writeValue(value);
    });
  }

  onChange: any = () => { }
  onTouch: any = () => { }

  writeValue(value: any) {
    this.ctrl.setValue(value, { emitEvent: false });
  }

  registerOnChange(fn: any) {
    this.onChange = fn
  }

  registerOnTouched(fn: any) {
    this.onTouch = fn
  }

  onFocus(e, t): void {
  }
}
