import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { UntilDestroy } from '@ngneat/until-destroy';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Select, Store } from '@ngxs/store';
import { IData, IState, IStore } from '@shared/type';
import { Observable, Subscription } from 'rxjs';
import { AddDataComponent } from 'src/app/components/add-data/add-data.component';
import { UpsertData } from 'src/app/store/actions';
import { OhMyState } from 'src/app/store/state';

@UntilDestroy({ arrayName: 'subscriptions' })
@Component({
  selector: 'oh-my-data-list-page',
  templateUrl: './data-list.component.html',
  styleUrls: ['./data-list.component.scss'],
})
export class PageDataListComponent implements OnInit {
  @Dispatch() upsertData = (data: IData) => new UpsertData(data);
  @Select(OhMyState.mainState) state$: Observable<IState>;

  public showRowAction = false;
  public state: IState;
  public domain: string;
  public subscriptions: Subscription[] = [];
  public navigateToMock = false;

  constructor(
    public dialog: MatDialog,
    private store: Store,
    private router: Router,
    private activatedRoute: ActivatedRoute,
  ) { }

  ngOnInit(): void {
    this.subscriptions.push(this.state$.subscribe((state: IState) => {
      this.state = state;

      if (this.navigateToMock) {
        this.router.navigate(['mocks', state.data[0].id]);
      }
    }));
  }

  onDataSelect(id: string): void {
    this.router.navigate(['mocks', id], { relativeTo: this.activatedRoute });
  }

  onMainAction(): void {
    this.showRowAction = !this.showRowAction;
  }

  onAddData(): void {
    const dialogRef = this.dialog.open(AddDataComponent, {
      width: '30%'
    });

    dialogRef.afterClosed().subscribe((data: IData) => {
      if (data) {
        this.navigateToMock = true;
        this.upsertData(data);
      }
    });
  }

  get stateSnapshot(): IState {
    return this.store.selectSnapshot<IState>((state: IStore) =>
      OhMyState.getActiveState(state)
    );
  }
}
