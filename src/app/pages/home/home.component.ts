import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Select, Store } from '@ngxs/store';
import { STORAGE_KEY } from '@shared/constants';
import { IData, IState, IStore } from '@shared/type';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { AddDataComponent } from 'src/app/components/add-data/add-data.component';
import { AppStateService } from 'src/app/services/app-state.service';
import { UpsertData } from 'src/app/store/actions';
import { OhMyState } from 'src/app/store/state';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  @Dispatch() upsertData = (data: IData) => new UpsertData(data);
  @Select(OhMyState.getActiveState) state$: Observable<IState>;

  public data: IData[];

  constructor(
    private appStateService: AppStateService,
    public dialog: MatDialog,
    private store: Store,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.state$
      .pipe(
        filter((state) => !!state),
        map((state) => state.data || [])
      )
      .subscribe((data: IData[]) => {
        this.data = data;
      });
  }

  onAddData(): void {
    const dialogRef = this.dialog.open(AddDataComponent, {
      width: '30%'
    });

    dialogRef.afterClosed().subscribe((data: IData) => {
      const state = this.stateSnapshot;
      const newDataIndex = state.data.length;
      this.upsertData(data);
      this.router.navigate(['mocks', newDataIndex]);
    });
  }

  get stateSnapshot(): IState {
    return this.store.selectSnapshot<IState>((state: IStore) =>
      OhMyState.getActiveState(state)
    );
  }
}
