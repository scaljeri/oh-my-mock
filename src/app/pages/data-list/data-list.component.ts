import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Select } from '@ngxs/store';
import { IData, IOhMyContext, IState } from '@shared/type';
import { StateUtils } from '@shared/utils/state';
import { Observable, Subscription } from 'rxjs';
import { AddDataComponent } from 'src/app/components/add-data/add-data.component';
import { UpsertData } from 'src/app/store/actions';
import { OhMyState } from 'src/app/store/state';

@Component({
  selector: 'oh-my-data-list-page',
  templateUrl: './data-list.component.html',
  styleUrls: ['./data-list.component.scss'],
})
export class PageDataListComponent implements OnInit, OnDestroy {
  static StateUtils = StateUtils;

  @Dispatch() upsertData = (data: IData) => new UpsertData(data);
  @Select(OhMyState.mainState) state$: Observable<IState>;

  private subscriptions = new Subscription();

  public showRowAction = false;
  public state: IState;
  public domain: string;
  public navigateToData: IOhMyContext;
  hasData = false;

  constructor(
    public dialog: MatDialog,
    private router: Router,
    private activatedRoute: ActivatedRoute,
  ) { }

  ngOnInit(): void {
    this.subscriptions.add(this.state$.subscribe((state: IState) => {
      this.state = state;
      this.hasData = Object.keys(this.state.data).length > 0;

      if (this.navigateToData) {
        this.router.navigate(['mocks', PageDataListComponent.StateUtils.findData(state, this.navigateToData).id]);
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
      width: '30%',
    });

    dialogRef.afterClosed().subscribe((data: IData) => {
      if (data) {
        this.navigateToData = data;
        this.upsertData(data);
      }
    });
  }

  // get stateSnapshot(): IState {
    // return null;
    // return this.store.selectSnapshot<IState>((state: IStore) =>
    //   OhMyState.getActiveState(state)
    // );
  // }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
