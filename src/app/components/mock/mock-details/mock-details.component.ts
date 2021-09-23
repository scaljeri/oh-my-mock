import { Component, Input, OnChanges } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { REQUIRED_MSG } from '@shared/constants';
import { IMock, IOhMyScenarios, ohMyDataId } from '@shared/type';
import { Observable } from 'rxjs';
import { UpsertMock, UpsertScenarios } from 'src/app/store/actions';
import { ManageScenariosComponent } from '../../manage-scenarios/manage-scenarios.component';

@Component({
  selector: 'oh-my-mock-details',
  templateUrl: './mock-details.component.html',
  styleUrls: ['./mock-details.component.scss']
})
export class MockDetailsComponent implements OnChanges {
  @Input() mock: IMock;
  @Input() domain: string;
  @Input() dataId: ohMyDataId;

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
    const contentType = update.contentType;
    delete update.contentType;

    debugger;
    return new UpsertMock({
      id: this.dataId,
      mock: { id: this.mock.id, ...update, headersMock: 
        { ...this.mock.headersMock, ['content-type']: contentType } }
    }, this.domain)
  };

  @Dispatch() updateScenarios = (scenarios: IOhMyScenarios) => new UpsertScenarios(scenarios, this.domain);

  constructor(public dialog: MatDialog) { }

  ngOnInit(): void {
    this.form = new FormGroup({
      delay: new FormControl(this.mock.delay, { updateOn: 'blur' }),
      statusCode: new FormControl(this.mock.statusCode, {
        validators: [Validators.required], updateOn: 'blur'
      }),
      scenario: new FormControl(this.mock.scenario),
      contentType: new FormControl(this.mock.headersMock['content-type'] || '')
    });

    this.form.valueChanges.subscribe((values: Partial<IMock>) => {
      debugger;
      if (this.statusCodeCtrl.hasError('required')) {
        delete values.statusCode;
      }

      this.upsertMock(values);
    });
  }

  ngOnChanges(): void {
    if (!this.form) {
      return;
    }

    this.form

    this.delayCtrl.setValue(this.mock.delay, { emitEvent: false, onlySelf: true });
    this.statusCodeCtrl.setValue(this.mock.statusCode,  { emitEvent: false, onlySelf: true });

    // this.scenarioCtrl.setValue(this.mock.scenario,  { emitEvent: false, onlySelf: true });
    // this.contentTypeCtrl.setValue(this.mock.headersMock['content-type'] || '',  { emitEvent: false, onlySelf: true });
  }

  // onContentTypeUpdate(contentType: string): void {
  //   if (contentType !== this.mock.headersMock['content-type']) {
  //     this.upsertMock({ headersMock: { ...this.mock.headersMock, 'content-type': contentType } });
  //   }
  // }

  onManageScenarios(): void {
    const dialogRef = this.dialog.open(ManageScenariosComponent, {
      width: '280px',
      height: '380px'
    });

    dialogRef.afterClosed().subscribe((scenarios: IOhMyScenarios) => {
      if (scenarios !== null && scenarios !== undefined) {
        console.log('received', scenarios);
        this.updateScenarios(scenarios);
      }
    });
  }

  get scenarioCtrl(): FormControl {
    return this.form.get('scenario') as FormControl;
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
}
