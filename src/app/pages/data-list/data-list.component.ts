import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Select, Store } from '@ngxs/store';
import { IData, IOhMyMock, IState, IStore } from '@shared/type';
import { Observable } from 'rxjs';
import { AddDataComponent } from 'src/app/components/add-data/add-data.component';
import { AppStateService } from 'src/app/services/app-state.service';
import { UpsertData } from 'src/app/store/actions';
import { OhMyState } from 'src/app/store/state';

@Component({
  selector: 'oh-my-data-list-page',
  templateUrl: './data-list.component.html',
  styleUrls: ['./data-list.component.scss']
})
export class PageDataListComponent {
  @Dispatch() upsertData = (data: IData) => new UpsertData(data);
  @Select(OhMyState.getState) state$: Observable<IOhMyMock>;

  public data: IData[];
  public domain: string;
  private state: IOhMyMock;

  constructor(
    public dialog: MatDialog,
    private appStateService: AppStateService,
    private store: Store,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) { }

  ngOnInit(): void {
    this.activatedRoute.params.subscribe(params => {
      const domain = params.domain;
      if (domain) {
        this.domain = decodeURIComponent(domain);
      }

      if (this.state) {
        this.data = this.state.domains[this.domain].data;
      }
    });

    this.state$.subscribe((state: IOhMyMock) => {
      this.state = state;
      this.data = state.domains[this.domain || this.appStateService.domain].data;
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

  onDataSelect(index: number): void {
    this.router.navigate(['mocks', index], { relativeTo: this.activatedRoute });
  }

  get stateSnapshot(): IState {
    return this.store.selectSnapshot<IState>((state: IStore) =>
      OhMyState.getActiveState(state)
    );
  }
}
