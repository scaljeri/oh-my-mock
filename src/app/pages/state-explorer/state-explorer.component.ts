import { Component, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { MatExpansionPanel } from '@angular/material/expansion';
import { HotToastService } from '@ngneat/hot-toast';
import { domain, IData, IOhMyContext, IState } from '@shared/type';
import { StorageUtils } from '@shared/utils/storage';

import { Subscription } from 'rxjs';
import { StateStreamService } from 'src/app/services/state-stream.service';
import { UpsertData } from 'src/app/store/actions';

@Component({
  selector: 'oh-my-state-explorer-page',
  templateUrl: './state-explorer.component.html',
  styleUrls: ['./state-explorer.component.scss']
})
export class PageStateExplorerComponent implements OnInit, OnDestroy {
  // @Dispatch() upsertData = (data: IData | IData[]) => new UpsertData(data, this.state.context);

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
    private stateStream: StateStreamService,
    private toast: HotToastService) { }

  ngOnInit(): void {
    this.subscriptions.add(this.stateStream.state$.subscribe(state => {
      this.state = state;
      this.domains = this.stateStream.store.domains.filter(d => d !== state.domain);
    }));
  }

  async onSelectDomain(domain = this.state.domain): Promise<void> {
    this.selectedDomain = domain;
    this.selectedState = await StorageUtils.get(domain);
    this.hasSelectedStateAnyRequests = Object.keys(this.selectedState.data)?.length > 0
    this.panels.toArray()[1].open();
  }

  onCloneAll(): void {
    const clones = [];
    Object.values(this.selectedState.data).forEach(data => {
      delete data.id;
      clones.push(data);
    });
    // this.upsertData(clones);
    this.toast.success(`Cloned ${Object.keys(this.selectedState.data).length} mocks`);
  }

  onDataSelect(id: string): void {
    // this.dataItem = findMocks(this.selectedState, { id });
    // this.panels.toArray()[2].open();
    // this.toast.warning('This functionality is currently disabled!');
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
