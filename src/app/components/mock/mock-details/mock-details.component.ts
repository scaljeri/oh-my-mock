import { Component, Input, OnChanges } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { REQUIRED_MSG } from '@shared/constants';
import { IMock, IOhMyScenarios, ohMyDataId, ohMyScenarioId } from '@shared/type';
import { Observable } from 'rxjs';
import { UpsertMock, UpsertScenarios } from 'src/app/store/actions';
import { AutocompleteDropdownComponent } from '../../form/autocomplete-dropdown/autocomplete-dropdown.component';
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

  @Dispatch() updateScenarios = (scenarios: IOhMyScenarios) => new UpsertScenarios(scenarios, this.domain);

  constructor(public dialog: MatDialog) {}

  ngOnInit(): void {
    debugger;
    this.form = new FormGroup({
      delay: new FormControl(this.mock.delay, { updateOn: 'blur' }),
      statusCode: new FormControl(this.mock.statusCode, {
        validators: [Validators.required], updateOn: 'blur'
      }),
      scenario: new FormControl(this.mock.scenario)
    });

    this.form.valueChanges.subscribe(values => {
      const update: Partial<IMock> = { scenario: values.scenario, delay: values.delay || 0 }
      if (!this.statusCodeCtrl.hasError('required')) {
        update.statusCode = values.statusCode;
      }

      this.upsertMock(update);
    });
  }

  ngOnChanges(): void {
    this.form?.patchValue({
      delay: this.mock.delay,
      statusCode: this.mock.statusCode,
      scenario: this.mock.scenario
    }, {  emitEvent: false });
  }

  onContentTypeUpdate(contentType: string): void {
	  if (contentType !== this.mock.headersMock['content-type']) {
    		this.upsertMock({ headersMock: { ...this.mock.headersMock, 'content-type': contentType } });
	  }
  }

  onManageScenarios(): void {
    const dialogRef = this.dialog.open(ManageScenariosComponent, {
      width: '280px',
      height: '380px'
    });

    dialogRef.afterClosed().subscribe((scenarios: IOhMyScenarios) => {
      if (scenarios !== null) {
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
}
