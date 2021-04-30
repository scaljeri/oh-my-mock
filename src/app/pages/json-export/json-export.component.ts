import { Component, OnInit, ViewChild } from '@angular/core';
import { Select, Store } from '@ngxs/store';
import { IData, IState, IStore } from '@shared/type';
import { DataListComponent } from 'src/app/components/data-list/data-list.component';
import { OhMyState } from 'src/app/store/state';
import { AppStateService } from 'src/app/services/app-state.service';
import { HotToastService } from '@ngneat/hot-toast';
import { Observable, Subscription } from 'rxjs';
import { UntilDestroy } from '@ngneat/until-destroy';
import { Router } from '@angular/router';

@UntilDestroy({ arrayName: 'subscriptions' })
@Component({
  selector: 'oh-my-json-export',
  templateUrl: './json-export.component.html',
  styleUrls: ['./json-export.component.scss']
})
export class JsonExportComponent implements OnInit {
  state: IState;
  selected: boolean[] = [];
  subscriptions: Subscription[] = [];
  exportList: IData[] = []

  @ViewChild(DataListComponent) dataListRef: DataListComponent;

  @Select(OhMyState.mainState) state$: Observable<IState>;

  constructor(
    private appStateService: AppStateService,
    private toast: HotToastService,
    private store: Store,
    private router: Router) { }

  ngOnInit(): void {
    this.subscriptions.push(this.state$.subscribe((state: IState) => {
      this.state = state;
    }))
  }

  getActiveStateSnapshot(): IState {
    return this.store.selectSnapshot<IState>((state: IStore) => OhMyState.getActiveState(state));
  }

  onRowExport(rowIndex: number): void {
    this.selected[rowIndex] = !this.selected[rowIndex];

  }

  onSelectAll(): void {
    this.dataListRef.selectAll();
    this.selected = this.state.data.map(() => true)
  }

  onExport() {
    if (!this.selected.some(x => x)) {
      return this.toast.warning('Nothing selected');
    }

    const data = this.selected.map((isSelected, index) => isSelected && this.state.data[index])
      .filter(Boolean);

    const exportObj = {
      data,
      domain: this.appStateService.domain,
      version: this.appStateService.version
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj));

    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", 'oh-my-mock-export.json');
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();

    this.toast.success(`Exported ${data.length} mocks as 'oh-my-mock-export.json'`);

    setTimeout(() => {
      this.router.navigate(['../']);
    }, 500);
  }

  get selectionCount(): number {
    return this.dataListRef ? this.dataListRef.selection.selected.length : 0;
  }
}
