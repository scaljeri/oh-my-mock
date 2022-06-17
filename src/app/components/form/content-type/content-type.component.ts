import { AfterViewInit, ChangeDetectionStrategy, Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, UntypedFormControl, NG_VALUE_ACCESSOR } from '@angular/forms';
import * as contentType from '@shared/utils/mime-type';

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

  ctrl = new UntypedFormControl(null, { updateOn: 'blur' });
  options = MIME_TYPES;

  private originalContentType: string;

  ngAfterViewInit(): void {
    this.ctrl.valueChanges.pipe(
    ).subscribe(value => {
      this.onChange(contentType.update(this.originalContentType, value));
      this.onTouch(contentType.update(this.originalContentType, value));
    });
  }

  onChange: any = () => { }
  onTouch: any = () => { }

  writeValue(value: any) {
    this.originalContentType = value;
    this.ctrl.setValue(contentType.strip(value), { emitEvent: false });
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
