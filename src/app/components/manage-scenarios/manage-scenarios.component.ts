import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { IOhMyScenarios, ohMyScenarioId } from '@shared/type';
import { uniqueId } from '@shared/utils/unique-id';

@Component({
  selector: 'oh-my-manage-scenarios',
  templateUrl: './manage-scenarios.component.html',
  styleUrls: ['./manage-scenarios.component.scss']
})
export class ManageScenariosComponent implements OnInit {
  @Input() scenarios: IOhMyScenarios;
  @Output() update = new EventEmitter<IOhMyScenarios>();

  scenarioIds: ohMyScenarioId[];
  scenariosCopy: IOhMyScenarios;

  ngOnInit(): void {
    this.scenariosCopy = { ... this.scenarios };
    this.scenarioIds = Object.keys(this.scenarios);
  }

  onClose(): void {
    this.update.emit(null);
  }

  onSave(): void {
    this.update.emit(this.scenarios);
  }

  onCreate(): void {
    const id = uniqueId();

    this.scenarioIds = [...this.scenarioIds, id];
    this.scenariosCopy[id] = '';
  }

  onDelete(id: ohMyScenarioId): void {
    this.scenarioIds = this.scenarioIds.filter(sid => sid !== id);
    delete this.scenariosCopy[id];
  }
}
