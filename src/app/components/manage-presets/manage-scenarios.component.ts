import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Inject, Input, Optional, Output, QueryList, ViewChildren } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Store } from '@ngxs/store';
import { STORAGE_KEY } from '@shared/constants';
import { domain, IOhMyPresets, IState, IStore, ohMyPresetId } from '@shared/type';
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
  @Input() scenarios: IOhMyPresets;
  @Input() domain: domain;

  @Output() update = new EventEmitter<IOhMyPresets>();

  @Dispatch() updateScenarios = (scenarios: IOhMyPresets) => {
    return new UpsertScenarios(scenarios, this.domain);
  }

  scenarioIds: ohMyPresetId[] = [];
  scenariosObj: IOhMyPresets = {};

  @ViewChildren('input') inputsEl: QueryList<ElementRef>;

  constructor(
    private store: Store,
    @Optional() private dialogRef: MatDialogRef<ManageScenariosComponent>,
    @Inject(MAT_DIALOG_DATA) private dialogScenarios: IOhMyPresets,
    private cdr: ChangeDetectorRef) {
    }

  ngAfterViewInit(): void {
    this.domain ??= this.dialogScenarios?.domain || OhMyState.domain;
    this.scenarios ??= this.dialogScenarios;

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

  onDelete(id: ohMyPresetId): void {
    this.scenarioIds = this.scenarioIds.filter(sid => sid !== id);
    delete this.scenariosObj[id];
  }

  isInDialog(): boolean {
    return true; /*(this.dialogScenarios && (this.dialogScenarios as IState).aux &&
     typeof (this.dialogScenarios as IState).aux === 'object'); */
  }

  get scenariosSnapshot(): IOhMyPresets {
    return this.store.selectSnapshot<IOhMyPresets>((state: IStore) => {
      return state[STORAGE_KEY].content.states[this.domain]?.presets;
    });
  }
}
