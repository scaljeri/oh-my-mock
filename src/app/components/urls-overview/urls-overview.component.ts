import { Component, Input, OnInit } from '@angular/core';
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
  selector: 'app-urls-overview',
  templateUrl: './urls-overview.component.html',
  styleUrls: ['./urls-overview.component.scss']
})
export class UrlsOverviewComponent implements OnInit {
  @Input() data: IData[] = [];

  @Dispatch() deleteData = (data: IDeleteData) => new DeleteData(data);
  // @Select(OhMyState.getState) state$: Observable<{ OhMyState: IState }>;
  // @Select(OhMyState.getActiveState) state$: Observable<IState>;

  displayedColumns = ['type', 'method', 'url', 'activeStatusCode'];

  edit = false;

  ngOnInit(): void {
  }

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
}
