import { ChangeDetectorRef, Component, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { MatExpansionPanel } from '@angular/material/expansion';
import { HotToastService } from '@ngxpert/hot-toast';
import { domain, IData, IOhMyContext, IOhMyRequests, IState } from '@shared/type';
import { StateUtils } from '@shared/utils/state';

import { Subscription } from 'rxjs';
import { startWith } from 'rxjs/operators';
import { OhMyState } from '../../services/oh-my-store';
import { OhMyStateService } from '../../services/state.service';
import { StorageService } from '../../services/storage.service';
import { WebWorkerService } from '../../services/web-worker.service';

@Component({
  standalone: false,
  selector: 'oh-my-state-explorer-page',
  templateUrl: './state-explorer.component.html',
  styleUrls: ['./state-explorer.component.scss']
})
export class PageStateExplorerComponent implements OnInit, OnDestroy {
  panelOpenState = true;
  domains!: domain[];
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

  @ViewChildren(MatExpansionPanel) panels!: QueryList<MatExpansionPanel>;

  constructor(
    private stateStream: OhMyStateService,
    private storageService: StorageService,
    private storeService: OhMyState,
    private cdr: ChangeDetectorRef,
    private webWorkerService: WebWorkerService,
    private toast: HotToastService) { }

  ngOnInit(): void {
    // TODO: listen for domain change??

    this.subscriptions.add(this.stateStream.store$.pipe(
      startWith(this.stateStream.store)).subscribe(store => {
        if (store) {
          this.state = this.stateStream.state;
          this.domains = store.domains.filter(d => d !== this.state.domain);
          this.cdr.detectChanges();
        }
      }));
  }

  async onSelectDomain(domain = this.state.domain): Promise<void> {
    this.selectedDomain = domain;

    await this.webWorkerService.init(domain);

    this.selectedState = await this.storageService.get(domain);
    this.selectedRequests = StateUtils.pickRequests(
      this.selectedState, await this.stateStream.loadRequests(this.selectedState));
    this.hasSelectedStateAnyRequests = this.selectedState.requests.length > 0;
    this.panels.toArray()[1].open();
    this.cdr.detectChanges();
  }

  async onCloneAll(): Promise<void> {
    for (const request of Object.values(this.selectedRequests)) {
      await this.storeService.cloneRequest(request.id, this.selectedState.context, this.state.context)
    }
    this.toast.success(`Cloned ${Object.keys(this.selectedRequests).length} mocks`);
    await this.storeService.updateAux({ filteredRequests: undefined }, this.state.context);
  }

  async onRequestCloned() {
    // The filter must be resetted otherwise the new request will not show
    await this.storeService.updateAux({ filteredRequests: undefined }, this.state.context);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
