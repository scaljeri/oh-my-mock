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

  // @Dispatch() deleteData = (data: IDeleteData) => new DeleteData(data);

  displayedColumns = ['type', 'method', 'url', 'activeStatusCode'];

  ngOnChanges(): void {
    if (this.showRowAction) {
      this.displayedColumns.unshift('edit');
    } else {
      this.displayedColumns.shift();
    }
  }

  onMainAction(): void {
    this.mainAction.emit();
    // this.edit = !this.edit;

    // if (this.edit) {
    //   this.displayedColumns.unshift('edit');
    // } else {
    //   this.displayedColumns.shift();
    // }
    // console.log(this.edit, this.displayedColumns);
  }

  onRowAction(rowIndex: number): void {
    this.rowAction.emit(rowIndex);
  }

  // onDeleteData(row: IDeleteData): void {
  //   this.deleteData(row);
  // }

  onDataClick(index: number): void {
    this.select.emit(index);
  }
}

