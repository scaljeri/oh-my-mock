import {
  ChangeDetectorRef,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  inject
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import {
  IData,
  IOhMyContext,
  IOhMyMockContext,
  IOhMyRequests,
  IState
} from '@shared/type';
import { StateUtils } from '@shared/utils/state';
import { Subscription } from 'rxjs';
import { AddDataComponent } from '../../components/add-data/add-data.component';
import { OhMyState } from '../../services/oh-my-store';
import { OhMyStateService } from '../../services/state.service';
import { DataListComponent } from '../../components/data-list/data-list.component';
import { ArrowComponent } from '../../components/arrow/arrow.component';
import { MatFabButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

@Component({
  selector: 'oh-my-data-list-page',
  templateUrl: './data-list.component.html',
  styleUrls: ['./data-list.component.scss'],
  imports: [
    DataListComponent,
    ArrowComponent,
    MatFabButton,
    MatIcon,
    RouterOutlet
  ]
})
export class PageDataListComponent implements OnInit, OnDestroy {
  private stateService = inject(OhMyStateService);
  private storeService = inject(OhMyState);
  dialog = inject(MatDialog);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  static StateUtils = StateUtils;

  private subscriptions = new Subscription();

  public showRowAction = false;
  public state!: IState;
  public domain!: string;
  public navigateToData!: IOhMyMockContext;
  context!: IOhMyContext;
  hasData = false;
  /** Requests are their own records; the list needs them next to the state. */
  requests: IOhMyRequests = {};

  ngOnInit(): void {
    // `state$` first: both replay their current value on subscribe, and the
    // template reads `state.context`, so the requests subscription must not be
    // the one that triggers the first render.
    this.subscriptions.add(
      this.stateService.state$.subscribe((state: IState) => {
        this.context = state.context;

        this.state = state;
        this.hasData = state.requests.length > 0;

        if (this.navigateToData) {
          // findRequest returns undefined when the target is not in this state,
          // which happens if the request was removed while the popup was closed.
          const request = PageDataListComponent.StateUtils.findRequest(
            state,
            this.requests,
            this.navigateToData
          );

          if (request?.id) {
            this.onDataSelect(request.id);
          }
        }
        this.cdr.detectChanges(); // Otherwise the change doesn't propagate to child
      })
    );

    this.subscriptions.add(
      this.stateService.requests$.subscribe((requests) => {
        this.requests = requests;
        this.cdr.detectChanges();
      })
    );
  }

  /**
   * Whether a request is selected, i.e. whether the detail pane has anything
   * to show. Driven by the child route rather than by local state, so a
   * deep-linked url opens with the pane already visible.
   */
  get hasDetail(): boolean {
    return !!this.activatedRoute.firstChild;
  }

  onDataSelect(id: string): void {
    this.ngZone.run(() => {
      this.router.navigate(['request', id], {
        relativeTo: this.activatedRoute
      });
    });
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
