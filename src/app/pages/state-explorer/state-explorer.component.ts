import { Component, OnInit, QueryList, ViewChildren } from '@angular/core';
import { MatExpansionPanel } from '@angular/material/expansion';
import { HotToastService } from '@ngneat/hot-toast';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Select, Store } from '@ngxs/store';
import { STORAGE_KEY } from '@shared/constants';
import { domain, IData, IOhMyMock, IState, IStore } from '@shared/type';

import { uniqueId } from '@shared/utils/unique-id';
import { Observable } from 'rxjs';
import { AppStateService } from 'src/app/services/app-state.service';
import { UpsertData } from 'src/app/store/actions';
import { OhMyState } from 'src/app/store/state';

@Component({
  selector: 'oh-my-state-explorer-page',
  templateUrl: './state-explorer.component.html',
  styleUrls: ['./state-explorer.component.scss']
})
export class PageStateExplorerComponent implements OnInit {
  @Select(OhMyState.getStore) state$: Observable<IOhMyMock>;
  @Dispatch() upsertData = (data: IData) => new UpsertData(data);

  public panelOpenState = true;
  public domains: domain[];
  public selectedDomain = '-';

  public state: IState;
  public selectedState: IState;
  public dataItem: IData;
  public showRowAction = true;
  public mainActionIconName = 'copy_all';
  public rowActionIconName = 'content_copy';

  @ViewChildren(MatExpansionPanel) panels: QueryList<MatExpansionPanel>;

  constructor(
    private appStateService: AppStateService,
    private store: Store,
    private toast: HotToastService) { }

  ngOnInit(): void {
    this.state$.subscribe((state) => {
      this.domains = Object.keys(state.domains).filter(d => d !== this.appStateService.domain);

      this.selectedState = state.domains[this.selectedDomain];
    });
  }

  async onSelectDomain(domain = this.appStateService.domain): Promise<void> {
    this.selectedDomain = domain;
    this.selectedState = this.getStateSnapshot(domain);

    this.panels.toArray()[1].open();
  }

  private cloneData(rowIndex: number): void {
    const data = {
      ...this.getStateSnapshot(this.selectedDomain).data[rowIndex],
      id: uniqueId()
    };

    this.upsertData(data);
  }

  onCloneAll(): void {
    const state = this.getStateSnapshot(this.selectedDomain);
    //state.data.forEach((_, i) => this.cloneData(i));

    this.toast.success(`Cloned ${state.data.length} mocks`);
  }

  onDataSelect(id: string): void {
    // this.dataItem = findMocks(this.selectedState, { id });
    this.panels.toArray()[2].open();
  }


  getStateSnapshot(domain: string): IState {
    return this.store.selectSnapshot<IState>((state: IStore) => state[STORAGE_KEY].domains[domain]);
  }

  getActiveStateSnapshot(): IState {
    return null; // this.store.selectSnapshot<IState>((state: IStore) => OhMyState.getActiveState(state));
  }
}
