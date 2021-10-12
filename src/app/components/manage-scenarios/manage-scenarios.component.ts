import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Inject, Input, Optional, Output, QueryList, ViewChildren } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Store } from '@ngxs/store';
import { STORAGE_KEY } from '@shared/constants';
import { domain, IOhMyScenarios, IState, IStore, ohMyScenarioId } from '@shared/type';
import { uniqueId } from '@shared/utils/unique-id';
import { UpsertScenarios } from 'src/app/store/actions';
import { OhMyState } from 'src/app/store/state';

@Component({
  selector: 'oh-my-manage-scenarios',
  templateUrl: './manage-scenarios.component.html',
  styleUrls: ['./manage-scenarios.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManageScenariosComponent implements AfterViewInit {
  @Input() scenarios: IOhMyScenarios;
  @Input() domain: domain;

  @Output() update = new EventEmitter<IOhMyScenarios>();

  @Dispatch() updateScenarios = (scenarios: IOhMyScenarios) => {
    return new UpsertScenarios(scenarios, this.domain);
  }

  scenarioIds: ohMyScenarioId[] = [];
  scenariosObj: IOhMyScenarios = {};

  @ViewChildren('input') inputsEl: QueryList<ElementRef>;

  constructor(
    private store: Store,
    @Optional() private dialogRef: MatDialogRef<ManageScenariosComponent>,
    @Optional() @Inject(MAT_DIALOG_DATA) private dialogScenarios: { scenarios?: IOhMyScenarios, domain?: domain },
    private cdr: ChangeDetectorRef) { }

  ngAfterViewInit(): void {
    this.domain ??= this.dialogScenarios?.domain || OhMyState.domain;
    this.scenarios ??= this.dialogScenarios?.scenarios || this.scenariosSnapshot || {};

    if (this.scenarios) {
      this.scenariosObj = { ... this.scenarios };
      this.scenarioIds = Object.keys(this.scenariosObj);
    }

    this.cdr.detectChanges();
  }

  onClose(): void {
    this.update.emit(null);
    this.dialogRef?.close(null);
  }

  onSave(): void {
    this.updateScenarios(this.scenariosObj);

    if (!this.isInDialog()) {
      this.dialogRef?.close(this.scenariosObj);
    } else {
      this.update.emit(this.scenariosObj);
    }
  }

  onCreate(): void {
    const id = uniqueId();

    this.scenarioIds = [...this.scenarioIds, id];
    this.scenariosObj[id] = '';

    setTimeout(() => {
      this.inputsEl.last.nativeElement.focus();
      this.inputsEl.last.nativeElement.scrollIntoView();
    });

    this.cdr.detectChanges();
  }

  onDelete(id: ohMyScenarioId): void {
    this.scenarioIds = this.scenarioIds.filter(sid => sid !== id);
    delete this.scenariosObj[id];
  }

  isInDialog(): boolean {
    return (this.dialogScenarios && (this.dialogScenarios as IState).aux &&
     typeof (this.dialogScenarios as IState).aux === 'object');
  }

  get scenariosSnapshot(): IOhMyScenarios {
    return this.store.selectSnapshot<IOhMyScenarios>((state: IStore) => {
      return state[STORAGE_KEY].content.states[this.domain]?.presets;
    });
  }
}
