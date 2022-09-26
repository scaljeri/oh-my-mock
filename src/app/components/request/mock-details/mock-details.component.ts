import { ChangeDetectorRef, Component, Input, OnChanges, OnInit } from '@angular/core';
import { UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { REQUIRED_MSG } from '@shared/constants';
import { IOhMyResponse, IOhMyContext } from '@shared/type';
import { Observable, Subscription } from 'rxjs';
import { OhMyState } from '../../../services/oh-my-store';

@Component({
  selector: 'oh-my-mock-details',
  templateUrl: './mock-details.component.html',
  styleUrls: ['./mock-details.component.scss']
})
export class MockDetailsComponent implements OnInit, OnChanges {
  @Input() response: IOhMyResponse;
  @Input() requestId: string;
  @Input() context: IOhMyContext;

  private subscriptions = new Subscription();
  requiredMsg = REQUIRED_MSG;
  form: UntypedFormGroup;

  mimeTypes = [
    'text/css',
    'text/csv',
    'text/html',
    'text/javascript',
    'image/svg+xml',
    'text/plain',
    'application/json'
  ];
  filteredMimeTypes$: Observable<string[]>;

  constructor(
    private storeService: OhMyState, public dialog: MatDialog,
    private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
    this.form = new UntypedFormGroup({
      delay: new UntypedFormControl(this.response.delay, { updateOn: 'blur' }),
      statusCode: new UntypedFormControl(this.response.statusCode, {
        validators: [Validators.required], updateOn: 'blur'
      }),
      label: new UntypedFormControl(this.response.label, { updateOn: 'blur' }),
      contentType: new UntypedFormControl(this.response.headersMock['content-type'] || '', { updateOn: 'blur' })
    });

    this.subscriptions.add(this.form.valueChanges.subscribe((values: Partial<IOhMyResponse> & { contentType: string }) => {
      if (this.statusCodeCtrl.hasError('required')) {
        delete values.statusCode;
      }

      delete values.contentType; // is not part if IOhMyResponse

      this.storeService.upsertResponse({
        ...values,
        headersMock: {
          ...this.response.headersMock,
          'content-type': this.contentTypeCtrl.value
        },
        id: this.response.id
      }, { id: this.requestId }, this.context);
      this.cdr.detectChanges();
    }));
  }

  ngOnChanges(): void {
    if (!this.form) {
      return;
    }

    this.delayCtrl.setValue(this.response.delay, { emitEvent: false, onlySelf: true });
    this.statusCodeCtrl.setValue(this.response.statusCode, { emitEvent: false, onlySelf: true });
    this.contentTypeCtrl.setValue(this.response.headersMock['content-type'], { emitEvent: false });
    this.labelCtrl.setValue(this.response.label, { emitEvent: false, onlySelf: true });
  }

  get labelCtrl(): UntypedFormControl {
    return this.form.get('label') as UntypedFormControl;
  }

  get statusCodeCtrl(): UntypedFormControl {
    return this.form.get('statusCode') as UntypedFormControl;
  }

  get delayCtrl(): UntypedFormControl {
    return this.form.get('delay') as UntypedFormControl;
  }

  get contentTypeCtrl(): UntypedFormControl {
    return this.form.get('contentType') as UntypedFormControl;
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
