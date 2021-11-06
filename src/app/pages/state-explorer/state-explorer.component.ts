import { Component, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { MatExpansionPanel } from '@angular/material/expansion';
import { HotToastService } from '@ngneat/hot-toast';
import { domain, IData, IOhMyContext, IState } from '@shared/type';

import { Subscription } from 'rxjs';
import { OhMyState } from 'src/app/services/oh-my-store';
import { OhMyStateService } from 'src/app/services/state.service';
import { StorageService } from 'src/app/services/storage.service';

@Component({
  selector: 'oh-my-state-explorer-page',
  templateUrl: './state-explorer.component.html',
  styleUrls: ['./state-explorer.component.scss']
})
export class PageStateExplorerComponent implements OnInit, OnDestroy {
  panelOpenState = true;
  domains: domain[];
  selectedDomain = '-';

  state: IState;
  selectedState: IState;
  dataItem: IData;
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
    private toast: HotToastService) { }

  ngOnInit(): void {
    this.subscriptions.add(this.stateStream.state$.subscribe(state => {
      this.state = state;
      this.domains = this.stateStream.store.domains.filter(d => d !== state.domain);
    }));
  }

  async onSelectDomain(domain = this.state.domain): Promise<void> {
    this.selectedDomain = domain;
    this.selectedState = await this.storageService.get(domain);
    this.hasSelectedStateAnyRequests = Object.keys(this.selectedState.data)?.length > 0
    this.panels.toArray()[1].open();
  }

  async onCloneAll(): Promise<void> {
    for(const request of Object.values(this.selectedState.data)) {
      await this.storeService.cloneRequest(request.id, this.selectedState.context, this.state.context)
    }
    this.toast.success(`Cloned ${Object.keys(this.selectedState.data).length} mocks`);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
