import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Store } from '@ngxs/store';
import {
  REQUIRED_MSG,
  STATUS_CODE_EXISTS_MSG,
  STATUS_CODE_INVALID_MSG,
  STORAGE_KEY
} from '@shared/constants';
import { IState, IStore, ohMyScenarioId } from '@shared/type';
import { OhMyState } from 'src/app/store/state';
// TODO: modify validator to check name + code
// import { statusCodeValidator } from '../../validators/status-code.validator';

@Component({
  selector: 'app-create-status-code',
  templateUrl: './create-status-code.component.html',
  styleUrls: ['./create-status-code.component.scss']
})
export class CreateStatusCodeComponent implements OnInit {
  public error: string;
  public form = new FormGroup({
    statusCode: new FormControl('', [
      Validators.required
      // statusCodeValidator(this.input.existingStatusCodes)
    ]),
    name: new FormControl(),
    clone: new FormControl('')
  })

  public requiredError = REQUIRED_MSG;
  public existsError = STATUS_CODE_EXISTS_MSG;
  public invalidError = STATUS_CODE_INVALID_MSG;
  private scenarios: Record<ohMyScenarioId, string>;
  public scenarioValues: string[] = [];

  constructor(
    private dialogRef: MatDialogRef<CreateStatusCodeComponent>,
    private store: Store,
    @Inject(MAT_DIALOG_DATA) private input: { existingStatusCodes: string[] }
  ) { }

  ngOnInit(): void {
    this.scenarios = this.stateSnapshot.scenarios;
    this.scenarioValues = ['aasd ', 'fwef wfe']; //  Object.values(this.stateSnapshot.scenarios);
  }

  onSave(): void {
    this.form.markAllAsTouched();

    if (this.form.valid) {
      this.dialogRef.close(this.form.value);
    }
  }

  onClose(): void {
    this.dialogRef.close();
  }

  get codeCtrl(): FormControl {
    return this.form.get('statusCode') as FormControl;
  }

  get nameCtrl(): FormControl {
    return this.form.get('name') as FormControl;
  }

  get cloneCtrl(): FormControl {
    return this.form.get('clone') as FormControl;
  }

  get stateSnapshot(): IState {
    return this.store.selectSnapshot<IState>((state: IStore) => {
      return state[STORAGE_KEY].content.states[OhMyState.domain];
    });
  }
}
