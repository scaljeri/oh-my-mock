import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { UntilDestroy } from '@ngneat/until-destroy';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Select, Store } from '@ngxs/store';
import { IData, IState, IStore } from '@shared/type';
import { Observable, Subscription } from 'rxjs';
import { AddDataComponent } from 'src/app/components/add-data/add-data.component';
import { DeleteData, UpsertData } from 'src/app/store/actions';
import { OhMyState } from 'src/app/store/state';

@UntilDestroy({ arrayName: 'subscriptions' })
@Component({
  selector: 'oh-my-data-list-page',
  templateUrl: './data-list.component.html',
  styleUrls: ['./data-list.component.scss'],
})
export class PageDataListComponent implements OnInit {
  @Dispatch() upsertData = (data: IData) => new UpsertData(data);
  @Dispatch() deleteData = (dataIndex: number) => new DeleteData(dataIndex);
  @Select(OhMyState.mainState) state$: Observable<IState>;

  public showRowAction = false;
  public state: IState;
  public domain: string;
  public subscriptions: Subscription[] = [];

  constructor(
    public dialog: MatDialog,
    private store: Store,
    private router: Router,
    private activatedRoute: ActivatedRoute,
  ) { }

  ngOnInit(): void {
    this.subscriptions.push(this.state$.subscribe((state: IState) => {
      this.state = state;
    }));
  }

  onDataSelect(index: number): void {
    this.router.navigate(['mocks', index], { relativeTo: this.activatedRoute });
  }

  onMainAction(): void {
    this.showRowAction = !this.showRowAction;
  }

  onRowAction(rowIndex: number): void {
    this.deleteData(rowIndex);
  }

  onAddData(): void {
    const dialogRef = this.dialog.open(AddDataComponent, {
      width: '30%'
    });

    dialogRef.afterClosed().subscribe((data: IData) => {
      if (data) {
        const state = this.stateSnapshot;
        const newDataIndex = state.data.length;
        this.upsertData(data);
        this.router.navigate(['mocks', newDataIndex]);
      }
    });
  }

  get stateSnapshot(): IState {
    return this.store.selectSnapshot<IState>((state: IStore) =>
      OhMyState.getActiveState(state)
    );
  }
}
