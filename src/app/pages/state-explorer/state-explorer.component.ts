import { ChangeDetectorRef, Component, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { MatExpansionPanel } from '@angular/material/expansion';
import { HotToastService } from '@ngneat/hot-toast';
import { IOhMyContext, IOhMyDomain, IOhMyDomainId, IOhMyRequest } from '@shared/type';

import { Subscription } from 'rxjs';
import { startWith } from 'rxjs/operators';
import { OhMyState } from '../../services/oh-my-store';
import { OhMyStateService } from '../../services/state.service';
import { StorageService } from '../../services/storage.service';
import { WebWorkerService } from '../../services/web-worker.service';

@Component({
  selector: 'oh-my-state-explorer-page',
  templateUrl: './state-explorer.component.html',
  styleUrls: ['./state-explorer.component.scss']
})
export class PageStateExplorerComponent implements OnInit, OnDestroy {
  panelOpenState = true;
  domains: IOhMyDomainId[];
  selectedDomain = '-';

  state: IOhMyDomain;
  selectedState: IOhMyDomain;
  dataItem: IOhMyRequest;
  showRowAction = true;
  mainActionIconName = 'copy_all';
  rowActionIconName = 'content_copy';
  subscriptions = new Subscription();
  context: IOhMyContext;
  hasSelectedStateAnyRequests: boolean;

  @ViewChildren(MatExpansionPanel) panels: QueryList<MatExpansionPanel>;

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
    this.hasSelectedStateAnyRequests = Object.keys(this.selectedState.requests)?.length > 0
    this.panels.toArray()[1].open();
    this.cdr.detectChanges();
  }

  async onCloneAll(): Promise<void> {
    for (const requestId of Object.values(this.selectedState.requests)) {
      await this.storeService.cloneRequest(requestId, this.selectedState.context, this.state.context)
    }
    this.toast.success(`Cloned ${Object.keys(this.selectedState.requests).length} mocks`);
    await this.storeService.updateAux({ filteredRequests: null }, this.state.context);
  }

  async onRequestCloned(request: IOhMyRequest) {
    // The filter must be resetted otherwise the new request will not show
    await this.storeService.updateAux({ filteredRequests: null }, this.state.context);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
