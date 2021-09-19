import { Component, Inject, Input, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Store } from '@ngxs/store';
import {
  REQUIRED_MSG,
  STATUS_CODE_EXISTS_MSG,
  STATUS_CODE_INVALID_MSG,
  STORAGE_KEY
} from '@shared/constants';
import { IMock, IOhMyMockRule, IOhMyScenarios, IState, IStore, IUpsertMock, ohMyScenarioId } from '@shared/type';
import { UpsertMock, UpsertScenarios } from 'src/app/store/actions';
import { OhMyState } from 'src/app/store/state';
// TODO: modify validator to check name + code
// import { statusCodeValidator } from '../../validators/status-code.validator';

@Component({
  selector: 'app-create-status-code',
  templateUrl: './create-status-code.component.html',
  styleUrls: ['./create-status-code.component.scss']
})
export class CreateStatusCodeComponent implements OnInit {
  @Input() mock: IMock;

  public error: string;
  public form = new FormGroup({
    statusCode: new FormControl('', Validators.required),
    scenario: new FormControl(),
    clone: new FormControl()
  })

  public requiredError = REQUIRED_MSG;
  public existsError = STATUS_CODE_EXISTS_MSG;
  public invalidError = STATUS_CODE_INVALID_MSG;
  public scenarios: Record<ohMyScenarioId, string>;
  public scenarioValues: string[] = [];

  scenariosUpdated = false;
  manageScenarios = false;

  constructor(
    private dialogRef: MatDialogRef<CreateStatusCodeComponent>,
    @Inject(MAT_DIALOG_DATA) private state: IState
  ) { }

  ngOnInit(): void {
    this.scenarios = this.state.scenarios;
    this.scenarioValues = Object.values(this.scenarios);

    // this.scenarioCtrl.valueChanges.subscribe(value => {
    // });
  }

  onSave(): void {
    this.codeCtrl.setValidators([Validators.required]);
    this.form.markAllAsTouched();

    if (this.form.valid) {
      const data = {
        mock: { 
          statusCode: this.form.value.statusCode,
          scenario: Object.entries(this.scenarios).find(([k, v]) => v === this.form.value.scenario)?.[0] },
        clone: !!this.form.value.clone
      };

      if (!data.mock.scenario) {
        delete data.mock.scenario;
      }

      this.dialogRef.close(data);
    }
  }

  onClose(): void {
    this.dialogRef.close();
  }

  onManageScenarios(): void {
    this.manageScenarios = true;
  }

  onScenariosUpdate(scenarios: IOhMyScenarios): void {
    this.manageScenarios = false;

    if (scenarios !== null) {
      this.scenariosUpdated = true;
      this.scenarios = scenarios;
      this.scenarioValues = Object.values(scenarios);
    }
  }

  get codeCtrl(): FormControl {
    return this.form.get('statusCode') as FormControl;
  }

  get scenarioCtrl(): FormControl {
    return this.form.get('scenario') as FormControl;
  }

  get cloneCtrl(): FormControl {
    return this.form.get('clone') as FormControl;
  }

  // get stateSnapshot(): IState {
  //   return this.store.selectSnapshot<IState>((state: IStore) => {
  //     return state[STORAGE_KEY].content.states[OhMyState.domain];
  //   });
  // }
}
