import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { IData, IOhMyContext, IOhMyMockContext, IState } from '@shared/type';
import { StateUtils } from '@shared/utils/state';
import { Subscription } from 'rxjs';
import { AddDataComponent } from '../../components/add-data/add-data.component';
import { OhMyState } from '../../services/oh-my-store';
import { OhMyStateService } from '../../services/state.service';

@Component({
  selector: 'oh-my-data-list-page',
  templateUrl: './data-list.component.html',
  styleUrls: ['./data-list.component.scss'],
})
export class PageDataListComponent implements OnInit, OnDestroy {
  static StateUtils = StateUtils;

  private subscriptions = new Subscription();

  public showRowAction = false;
  public state: IState;
  public domain: string;
  public navigateToData: IOhMyMockContext;
  context: IOhMyContext;
  hasData = false;

  constructor(
    private stateService: OhMyStateService,
    private storeService: OhMyState,
    public dialog: MatDialog,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) { }

  ngOnInit(): void {
    this.subscriptions.add(this.stateService.state$.subscribe((state: IState) => {
      this.context = state.context;

      this.state = state;
      this.hasData = Object.keys(this.state.data).length > 0;

      if (this.navigateToData) {
        this.onDataSelect(PageDataListComponent.StateUtils.findRequest(state, this.navigateToData).id);
      }
      this.cdr.detectChanges(); // Otherwise the change doesn't propagate to child
    }));
  }

  onDataSelect(id: string): void {
    this.ngZone.run(() => {
      this.router.navigate(['request', id], { relativeTo: this.activatedRoute });
    });
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
        // To be able to navigate to the requests mocks page, it first needs to be created,
        // which is why the request information is stored in a tmp variable for later processing
        this.navigateToData = data;
        this.storeService.upsertRequest(data, this.context);
        // this.upsertRequest(data);
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
