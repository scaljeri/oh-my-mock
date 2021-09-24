import { AfterViewInit, ChangeDetectionStrategy, Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, FormControl, NG_VALUE_ACCESSOR } from '@angular/forms';

const MIME_TYPES = [
  'text/css',
  'text/csv',
  'text/html',
  'text/javascript',
  'image/svg+xml',
  'text/plain',
  'application/json'
];

@Component({
  selector: 'oh-my-content-type',
  templateUrl: './content-type.component.html',
  styleUrls: ['./content-type.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ContentTypeComponent),
      multi: true
    },
    // {
    //   provide: NG_VALIDATORS,
    //   useExisting: ContentTypeComponent,
    //   multi: true
    // }
  ]
})
export class ContentTypeComponent implements AfterViewInit, ControlValueAccessor {
  @Input() contentType: string;

  ctrl = new FormControl(null, { updateOn: 'blur' });
  options = MIME_TYPES;

  ngAfterViewInit(): void {
    this.ctrl.valueChanges.pipe(
    ).subscribe(value => {
      this.onChange(value);
      this.onTouch(value);
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
