import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
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
  ],
  // Stated rather than inherited: Angular 22 made OnPush the default for every
  // component, so this one has been OnPush since the upgrade whether it said so
  // or not. Writing it down is what makes the change-detection calls below read
  // as deliberate instead of superstitious.
  changeDetection: ChangeDetectionStrategy.OnPush
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

  /** Optional: the list renders only once the state has arrived. */
  @ViewChild(DataListComponent) dataListRef?: DataListComponent;

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
      // `hasDetail` reads the child route, and routing is asynchronous: by the
      // time `navigate` resolves, the click that started it has long since had
      // its change-detection pass, which ran while `firstChild` was still the
      // old value. Under OnPush nothing checks this view again, so the detail
      // pane does not open — the class stays off `.oh-panes` and `@if
      // (hasDetail)` keeps the outlet unrendered. Today a `state$` emission
      // usually arrives soon after and hides it; that is a coincidence of
      // timing, not a mechanism.
      void this.router
        .navigate(['request', id], { relativeTo: this.activatedRoute })
        .then(() => this.cdr.markForCheck());
    });
  }

  /**
   * Closes the detail panel and hands the full width back to the list.
   *
   * Needed because the panel overlays the list: the `x` in the detail header
   * deletes the response on display, so there was no way out of a pane that now
   * covers what is behind it.
   *
   * The highlight goes with it. A selected row is exempt from the filter — see
   * `DataListComponent.onDataClick` — so leaving it behind would leave a row
   * standing in a filtered list with nothing open to explain why.
   */
  onCloseDetail(): void {
    this.ngZone.run(() => {
      // Closing has the same asynchrony as opening: `hasDetail` only goes false
      // once the navigation away from the child route has resolved, and the
      // `(click)` that asked for it was checked before that happened. Without
      // the mark the pane stays on screen over the list it is covering, which
      // is the exact state this method exists to get out of.
      void this.router
        .navigate(['./'], { relativeTo: this.activatedRoute })
        .then(() => this.cdr.markForCheck());
    });

    this.dataListRef?.deselectAll();
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
