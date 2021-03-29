import { Component, OnInit, ViewChild } from '@angular/core';
import { Store } from '@ngxs/store';
import { IData, IState, IStore } from '@shared/type';
import { DataListComponent } from 'src/app/components/data-list/data-list.component';
import { OhMyState } from 'src/app/store/state';
import { AppStateService } from 'src/app/services/app-state.service';
import { HotToastService } from '@ngneat/hot-toast';

@Component({
  selector: 'oh-my-json-export',
  templateUrl: './json-export.component.html',
  styleUrls: ['./json-export.component.scss']
})
export class JsonExportComponent implements OnInit {
  dataList: IData[];
  allSelected = false;
  selected: boolean[] = [];

  exportList: IData[] = []
  @ViewChild(DataListComponent) dataListRef: DataListComponent;

  constructor(private appStateService: AppStateService, private toast: HotToastService, private store: Store) { }

  ngOnInit(): void {
    this.dataList = this.getActiveStateSnapshot()?.data;
  }

  getActiveStateSnapshot(): IState {
    return this.store.selectSnapshot<IState>((state: IStore) => OhMyState.getActiveState(state));
  }

  onRowExport(rowIndex: number): void {
    this.selected[rowIndex] = !this.selected[rowIndex];

  }

  onSelectAll(): void {
    if (this.allSelected) {
      this.dataListRef.deselectAll();
    } else {
      this.dataListRef.selectAll();
    }

    this.allSelected = !this.allSelected;
  }

  onExport() {
    if (this.dataListRef.selection.selected.length === 0) {
      return this.toast.warning('Nothing selected');
    }
    const data = this.dataListRef.selection.selected.map((v) => this.dataList[v]);
    const exportObj = {
      data,
      domain: this.appStateService.domain
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj));

    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", 'oh-my-mock-export.json');
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();

    this.toast.success('Mocks exported as `oh-my-mock-export.json`');
  }

  get selectionCount(): number {
    return this.dataListRef ? this.dataListRef.selection.selected.length : 0;
  }
}
