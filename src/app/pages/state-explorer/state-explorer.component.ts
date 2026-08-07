import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
  inject
} from '@angular/core';
import {
  MatExpansionPanel,
  MatAccordion,
  MatExpansionPanelHeader,
  MatExpansionPanelTitle,
  MatExpansionPanelDescription
} from '@angular/material/expansion';
import { HotToastService } from '@ngxpert/hot-toast';
import {
  IData,
  IOhMyContext,
  IOhMyRequests,
  IState,
  ohMyDomain
} from '@shared/type';
import { StateUtils } from '@shared/utils/state';

import { Subscription } from 'rxjs';
import { startWith } from 'rxjs/operators';
import { OhMyState } from '../../services/oh-my-store';
import { OhMyStateService } from '../../services/state.service';
import { StorageService } from '../../services/storage.service';
import { WebWorkerService } from '../../services/web-worker.service';
import { MatCard } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import { MatMiniFabButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { DataListComponent } from '../../components/data-list/data-list.component';

@Component({
  selector: 'oh-my-state-explorer-page',
  templateUrl: './state-explorer.component.html',
  styleUrls: ['./state-explorer.component.scss'],
  imports: [
    MatCard,
    MatAccordion,
    MatExpansionPanel,
    MatExpansionPanelHeader,
    MatExpansionPanelTitle,
    MatExpansionPanelDescription,
    RouterLink,
    MatMiniFabButton,
    MatIcon,
    DataListComponent
  ]
})
export class PageStateExplorerComponent implements OnInit, OnDestroy {
  private stateStream = inject(OhMyStateService);
  private storageService = inject(StorageService);
  private storeService = inject(OhMyState);
  private cdr = inject(ChangeDetectorRef);
  private webWorkerService = inject(WebWorkerService);
  private toast = inject(HotToastService);

  panelOpenState = true;
  // Optional, not `!`: filled in from the store subscription, so the template
  // asks for its length before it exists.
  domains?: ohMyDomain[];
  selectedDomain = '-';

  state!: IState;
  selectedState!: IState;
  // null while no request is expanded in the explorer.
  dataItem: IData | null = null;
  showRowAction = true;
  mainActionIconName = 'copy_all';
  rowActionIconName = 'content_copy';
  subscriptions = new Subscription();
  context!: IOhMyContext;
  hasSelectedStateAnyRequests!: boolean;
  /**
   * The selected domain's request records, by id.
   *
   * This page is the one place that shows a state other than the active one,
   * so it loads that domain's requests itself.
   */
  selectedRequests: IOhMyRequests = {};

  /**
   * The panel the picked domain's mocks are shown in.
   *
   * By its template reference rather than `@ViewChildren(MatExpansionPanel)`
   * and `toArray()[1]`, which said "the second panel in source order" when it
   * meant "the one holding the list" — adding a panel above it, or putting it
   * behind an `@if`, would have moved the index without anything failing to
   * compile.
   */
  @ViewChild('panel') private selectedPanel?: MatExpansionPanel;

  private isDestroyed = false;

  /**
   * Which domain read is the current one.
   *
   * `onSelectDomain` is three awaits long — the worker, the state, then the
   * requests — so clicking a second domain before the first has answered runs
   * two of them at once. Without this the slower read finishes last and puts
   * its state on screen under the newer domain's name: the header says one
   * domain and the list below it belongs to another, and it stays that way
   * until something else redraws the page. The sidebar's group list is several
   * awaits deep for the same reason and guards it the same way.
   */
  private domainReadId = 0;

  ngOnInit(): void {
    // TODO: listen for domain change??

    this.subscriptions.add(
      this.stateStream.store$
        .pipe(startWith(this.stateStream.store))
        .subscribe((store) => {
          if (store) {
            this.state = this.stateStream.state;
            this.domains = store.domains.filter((d) => d !== this.state.domain);
            this.detectChanges();
          }
        })
    );
  }

  async onSelectDomain(domain = this.state.domain): Promise<void> {
    const readId = ++this.domainReadId;

    this.selectedDomain = domain;

    await this.webWorkerService.init(domain);

    // Read into locals, then publish the lot in one go below. Assigning
    // `selectedState` before the requests that go with it have been fetched
    // left the list rendering one domain's state against another's records for
    // as long as that last await took, if anything redrew the page in between.
    //
    // `get` is generic over everything the store holds and used to take its
    // type from the field it was assigned to, hence the explicit `IState`.
    const selectedState = await this.storageService.get<IState>(domain);
    const selectedRequests = StateUtils.pickRequests(
      selectedState,
      await this.stateStream.loadRequests(selectedState)
    );

    if (readId !== this.domainReadId) {
      return;
    }

    this.selectedState = selectedState;
    this.selectedRequests = selectedRequests;
    this.hasSelectedStateAnyRequests = selectedState.requests.length > 0;
    // Opening before the render rather than after it: `open()` only sets the
    // panel's own flag and marks it for check, so the single pass below is what
    // puts both the expansion and the list inside it on screen. Opening
    // afterwards would leave the panel shut until something else happened to
    // trigger change detection.
    this.selectedPanel?.open();
    this.detectChanges();
  }

  async onCloneAll(): Promise<void> {
    for (const request of Object.values(this.selectedRequests)) {
      await this.storeService.cloneRequest(
        request.id,
        this.selectedState.context,
        this.state.context
      );
    }
    this.toast.success(
      `Cloned ${Object.keys(this.selectedRequests).length} mocks`
    );
    await this.storeService.updateAux(
      { filteredRequests: undefined },
      this.state.context
    );
  }

  async onRequestCloned() {
    // The filter must be resetted otherwise the new request will not show
    await this.storeService.updateAux(
      { filteredRequests: undefined },
      this.state.context
    );
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.subscriptions.unsubscribe();
  }

  /**
   * Rendering a view that has been torn down.
   *
   * `onSelectDomain` resumes after three awaits, and the popup can be closed or
   * the tab switched to another page while the storage read is still out. The
   * shape is the one `domains`, `domain-sidebar` and `har-import` already use.
   *
   * Note that Angular no longer punishes the unguarded call: `refreshView`
   * returns early on a destroyed `LView`, so the `ViewDestroyedError` this used
   * to raise is gone and the call is a no-op. The guard is here to state the
   * invariant, not to prevent a crash.
   */
  private detectChanges(): void {
    if (!this.isDestroyed) {
      this.cdr.detectChanges();
    }
  }
}
