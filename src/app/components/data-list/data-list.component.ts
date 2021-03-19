import { Component, EventEmitter, HostBinding, Inject, Input, Optional, Output, SimpleChanges } from '@angular/core';
import { IData } from 'src/shared/type';

@Component({
  selector: 'oh-my-data-list',
  templateUrl: './data-list.component.html',
  styleUrls: ['./data-list.component.scss']
})
export class DataListComponent {
  @Input() data: IData[] = [];
  @Input() showRowAction = false;
  @Input() mainActionIconName = 'edit';
  @Input() rowActionIconName = 'delete';
  @Input() @HostBinding('class') theme = 'dark';

  @Output() select = new EventEmitter<number>();
  @Output() rowAction = new EventEmitter<number>();
  @Output() mainAction = new EventEmitter<number>();

  displayedColumns = ['type', 'method', 'url', 'activeStatusCode'];

  ngOnChanges(): void {
    if (this.displayedColumns.indexOf('rowAction') === 0) {
      this.displayedColumns.shift();
    }

    if (this.showRowAction) {
      this.displayedColumns.unshift('rowAction');
    }
  }

  onMainAction(): void {
    this.mainAction.emit();
  }

  onRowAction(event: MouseEvent, rowIndex: number): void {
    event.stopPropagation();
    this.rowAction.emit(rowIndex);
  }

  onDataClick(index: number): void {
    this.select.emit(index);
  }
}

