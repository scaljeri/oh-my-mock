import { Component, Input, OnChanges, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { REQUIRED_MSG } from '@shared/constants';
import { IMock, ohMyDataId } from '@shared/type';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { UpsertMock } from 'src/app/store/actions';

@Component({
  selector: 'oh-my-mock-details',
  templateUrl: './mock-details.component.html',
  styleUrls: ['./mock-details.component.scss']
})
export class MockDetailsComponent implements OnInit, OnChanges {
  @Input() mock: IMock;
  @Input() domain: string;
  @Input() dataId: ohMyDataId;

  requiredMsg = REQUIRED_MSG;
  form: FormGroup;
  mimeTypeCtrl = new FormControl();

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

  @Dispatch() upsertMock = (update: Partial<IMock>) =>
    new UpsertMock({
      id: this.dataId,
      mock: { id: this.mock.id, ...update }
    }, this.domain);

  ngOnInit(): void {
    this.filteredMimeTypes$ = this.mimeTypeCtrl.valueChanges.pipe(
      map(value => this.mimeTypes.filter(mt => mt.includes(value)))
    );
  }

  ngOnChanges(): void {
    this.form = new FormGroup({
      delay: new FormControl(this.mock.delay, { updateOn: 'blur' }),
      statusCode: new FormControl(this.mock.statusCode, {
        validators: [Validators.required], updateOn: 'blur'
      }),
      name: new FormControl(this.mock.name, { updateOn: 'blur' })
    });
    this.mimeTypeCtrl.setValue(`${this.mock.type}/${this.mock.subType}`);

    this.form.valueChanges.subscribe(values => {
      const update: Partial<IMock> = { name: values.name, delay: values.delay || 0 }
      if (!this.statusCodeCtrl.hasError('required')) {
        update.statusCode = values.statusCode;
      }

      this.upsertMock(update);
    });
  }

  onMimeTypeBlur(): void {
    this.upsertMock({ headersMock: {...this.mock.headersMock, 'content-type': this.mimeTypeCtrl.value}});
  }

  get nameCtrl(): FormControl {
    return this.form.get('name') as FormControl;
  }

  get statusCodeCtrl(): FormControl {
    return this.form.get('statusCode') as FormControl;
  }

  get delayCtrl(): FormControl {
    return this.form.get('delay') as FormControl;
  }
}
