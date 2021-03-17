import { Component, OnInit, QueryList, ViewChildren } from '@angular/core';
import { MatExpansionPanel } from '@angular/material/expansion';
import {
  ActivatedRoute,
  Router
} from '@angular/router'
import { HotToastService } from '@ngneat/hot-toast';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Select, Store } from '@ngxs/store';
import { STORAGE_KEY } from '@shared/constants';
import { domain, IData, IOhMyMock, IState, IStore } from '@shared/type';
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
  @Select(OhMyState.getState) state$: Observable<IOhMyMock>;
  @Dispatch() upsertData = (data: IData) => new UpsertData(data);

  public panelOpenState = true;
  public domains: domain[];
  public selectedDomain = '-';

  public dataList: IData[];
  public dataItem: IData;
  public showRowAction = true;
  public mainActionIconName = 'copy_all';
  public rowActionIconName = 'content_copy';

  private dataItemIndex: number;

  @ViewChildren(MatExpansionPanel) panels: QueryList<MatExpansionPanel>;

  constructor(
    private appStateService: AppStateService,
    private store: Store,
    private toast: HotToastService) {}

  ngOnInit(): void {
    this.state$.subscribe((state) => {
      this.domains = Object.keys(state.domains).filter(d => d !== this.appStateService.domain);

      if (this.dataItem) {
        this.dataItem = state.domains[this.selectedDomain].data[this.dataItemIndex];
      }
    });
  }

  async onSelectDomain(domain = this.appStateService.domain): Promise<void> {
    this.selectedDomain = domain;
    this.dataList = this.getStateSnapshot(domain).data;

    this.panels.toArray()[1].open();
  }

  onMainAction(): void {
    this.getStateSnapshot(this.selectedDomain).data.forEach((_, i) => this.onRowAction(i));
  }

  onRowAction(rowIndex: number): void {
    const state = this.getActiveStateSnapshot();
    const data = this.getStateSnapshot(this.selectedDomain).data[rowIndex];

    if (!state.data.some(d => d.url === data.url )) {
      this.upsertData(data);
      this.toast.success('Cloned ' + data.url);
    } else {
      this.toast.error(`Mock already exists (${data.url})`);
    }
  }

  onDataSelect(rowIndex: number): void {
    this.dataItem = this.dataList[rowIndex];
    this.dataItemIndex = rowIndex;
    this.panels.toArray()[2].open();
  }


  getStateSnapshot(domain: string): IState {
    return this.store.selectSnapshot<IState>((state: IStore) => state[STORAGE_KEY].domains[domain]);
  }

  getActiveStateSnapshot(): IState {
    return this.store.selectSnapshot<IState>((state: IStore) => OhMyState.getActiveState(state));
  }
}
