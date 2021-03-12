import { Component, OnInit } from '@angular/core';
import { Select } from '@ngxs/store';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { OhMyState } from 'src/app/store/state';
import { IContext, IData, IDeleteData, IState } from 'src/shared/type';
import { STORAGE_KEY } from 'src/shared/constants';
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
  styleUrls: ['./urls-overview.component.scss'],
})
export class UrlsOverviewComponent implements OnInit {
  // @Select(OhMyState.getState) state$: Observable<{ OhMyState: IState }>;

  @Dispatch() deleteData = (data: IDeleteData) => new DeleteData(data);
  @Select(OhMyState.getActiveState) state$: Observable<IState>;

  displayedColumns = ['type', 'method', 'url', 'activeStatusCode'];

  data: IData[] = [];
  edit = false;

  ngOnInit(): void {
    this.state$
      .pipe(
        filter((state) => !!state),
        map((state) => state?.data)
      )
      .subscribe((data: IData[]) => {
        this.data = data;
      });
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
