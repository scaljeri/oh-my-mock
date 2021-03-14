import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IData, IDeleteData } from 'src/shared/type';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { DeleteData } from 'src/app/store/actions';

export interface PeriodicElement {
  name: string;
  position: number;
  weight: number;
  symbol: string;
}

@Component({
  selector: 'oh-my-data-list',
  templateUrl: './data-list.component.html',
  styleUrls: ['./data-list.component.scss']
})
export class UrlsOverviewComponent {
  @Input() data: IData[] = [];
  @Output() select = new EventEmitter<number>();

  @Dispatch() deleteData = (data: IDeleteData) => new DeleteData(data);

  displayedColumns = ['type', 'method', 'url', 'activeStatusCode'];
  edit = false;

  onEdit(): void {
    this.edit = !this.edit;

    if (this.edit) {
      this.displayedColumns.unshift('edit');
    } else {
      this.displayedColumns.shift();
    }
    console.log(this.edit, this.displayedColumns);
  }

  onDeleteData(row: IDeleteData): void {
    this.deleteData(row);
  }

  onDataClick(index: number): void {
    this.select.emit(index);
  }
}
