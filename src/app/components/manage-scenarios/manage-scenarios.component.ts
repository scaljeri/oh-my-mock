import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Inject, Input, Output, QueryList, ViewChildren } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { domain, IOhMyScenarios, ohMyScenarioId } from '@shared/type';
import { uniqueId } from '@shared/utils/unique-id';
import { UpsertScenarios } from 'src/app/store/actions';

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

  scenarioIds: ohMyScenarioId[];
  scenariosCopy: IOhMyScenarios;

  @ViewChildren('input') inputsEl: QueryList<ElementRef>;

  constructor(
    private dialogRef: MatDialogRef<ManageScenariosComponent>,
    @Inject(MAT_DIALOG_DATA) private dialogScenarios: { scenarios: IOhMyScenarios, domain: domain },
    private cdr: ChangeDetectorRef) { }

  ngAfterViewInit(): void {
    this.domain ??= this.dialogScenarios.domain;
    this.scenariosCopy = { ... this.scenarios || this.dialogScenarios?.scenarios };
    this.scenarioIds = Object.keys(this.scenariosCopy || {});

    this.cdr.detectChanges();
  }

  onClose(): void {
    this.update.emit(null);
  }

  onSave(): void {
    this.updateScenarios(this.scenariosCopy);

    if (this.scenarios) {
      this.update.emit(this.scenariosCopy);
    } else {
      this.dialogRef.close(this.scenariosCopy);
    }
  }

  onCreate(): void {
    const id = uniqueId();

    this.scenarioIds = [...this.scenarioIds, id];
    this.scenariosCopy[id] = '';

    setTimeout(() => {
      this.inputsEl.last.nativeElement.focus();
      this.inputsEl.last.nativeElement.scrollIntoView();
    });

    this.cdr.detectChanges();
  }

  onDelete(id: ohMyScenarioId): void {
    this.scenarioIds = this.scenarioIds.filter(sid => sid !== id);
    delete this.scenariosCopy[id];
  }
}
