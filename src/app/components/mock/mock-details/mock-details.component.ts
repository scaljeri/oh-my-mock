import { Component, Input, OnChanges } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { REQUIRED_MSG } from '@shared/constants';
import { IMock, IOhMyContext, ohMyDataId } from '@shared/type';
import { Observable, Subscription } from 'rxjs';
import { UpsertMock } from 'src/app/store/actions';

@Component({
  selector: 'oh-my-mock-details',
  templateUrl: './mock-details.component.html',
  styleUrls: ['./mock-details.component.scss']
})
export class MockDetailsComponent implements OnChanges {
  @Input() mock: IMock;
  @Input() requestId: ohMyDataId;
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

  @Dispatch() upsertMock = (update: Partial<IMock & { contentType?: string }> ) => {
    debugger;
    const contentType = update.contentType;
    delete update.contentType;

    return new UpsertMock({
      id: this.requestId,
      mock: { id: this.mock.id, ...update, headersMock:
        { ...this.mock.headersMock, ['content-type']: contentType } }
    }, this.context)
  };

  // @Dispatch() updateScenarios = (scenarios: IOhMyPresets) => new UpsertScenarios(scenarios, this.domain);
  // @Select(OhMyState.mainState) state$: Observable<IState>;

  constructor(public dialog: MatDialog) { }

  ngOnInit(): void {
    this.form = new FormGroup({
      delay: new FormControl(this.mock.delay, { updateOn: 'blur' }),
      statusCode: new FormControl(this.mock.statusCode, {
        validators: [Validators.required], updateOn: 'blur'
      }),
      label: new FormControl(this.mock.label, { updateOn: 'blur'}),
      contentType: new FormControl(this.mock.headersMock['content-type'] || '', { updateOn: 'blur' })
    });

    this.subscriptions.add(this.form.valueChanges.subscribe((values: Partial<IMock>) => {
      if (this.statusCodeCtrl.hasError('required')) {
        delete values.statusCode;
      }

      this.upsertMock(values);
    }));
  }

  ngOnChanges(): void {
    if (!this.form) {
      return;
    }

    this.delayCtrl.setValue(this.mock.delay, { emitEvent: false, onlySelf: true });
    this.statusCodeCtrl.setValue(this.mock.statusCode,  { emitEvent: false, onlySelf: true });
    this.contentTypeCtrl.setValue(this.mock.headersMock['content-type'], { emitEvent: false });
    this.labelCtrl.setValue(this.mock.label,  { emitEvent: false, onlySelf: true });
  }

  onManageScenarios(): void {
    // const dialogRef = this.dialog.open(ManageScenariosComponent, {
    //   width: '280px',
    //   height: '380px'
    // });

    // dialogRef.afterClosed().subscribe((scenarios: IOhMyPresets) => {
    //   if (scenarios !== null && scenarios !== undefined) {
    //     console.log('received', scenarios);
    //     this.updateScenarios(scenarios);
    //   }
    // });
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
