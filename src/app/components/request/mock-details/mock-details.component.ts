import { ChangeDetectorRef, Component, Input, OnChanges, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { REQUIRED_MSG } from '@shared/constants';
import { IMock, IOhMyContext } from '@shared/type';
import { Observable, Subscription } from 'rxjs';
import { OhMyState } from 'src/app/services/oh-my-store';

@Component({
  selector: 'oh-my-mock-details',
  templateUrl: './mock-details.component.html',
  styleUrls: ['./mock-details.component.scss']
})
export class MockDetailsComponent implements OnInit, OnChanges {
  @Input() response: IMock;
  @Input() requestId: string;
  @Input() context: IOhMyContext;

  private subscriptions = new Subscription();
  requiredMsg = REQUIRED_MSG;
  form: FormGroup;

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
    this.form = new FormGroup({
      delay: new FormControl(this.response.delay, { updateOn: 'blur' }),
      statusCode: new FormControl(this.response.statusCode, {
        validators: [Validators.required], updateOn: 'blur'
      }),
      label: new FormControl(this.response.label, { updateOn: 'blur' }),
      contentType: new FormControl(this.response.headersMock['content-type'] || '', { updateOn: 'blur' })
    });

    this.subscriptions.add(this.form.valueChanges.subscribe((values: Partial<IMock> & { contentType: string }) => {
      if (this.statusCodeCtrl.hasError('required')) {
        delete values.statusCode;
      }

      delete values.contentType; // is not part if IMock

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

  get labelCtrl(): FormControl {
    return this.form.get('label') as FormControl;
  }

  get statusCodeCtrl(): FormControl {
    return this.form.get('statusCode') as FormControl;
  }

  get delayCtrl(): FormControl {
    return this.form.get('delay') as FormControl;
  }

  get contentTypeCtrl(): FormControl {
    return this.form.get('contentType') as FormControl;
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
