import { Component, OnInit, ViewChild } from '@angular/core';
import { IOhMyRequest, IOhMyResponse,  IOhMyDomain } from '@shared/types';
import { DataListComponent } from '../../components/data-list/data-list.component';
import { AppStateService } from '../../services/app-state.service';
import { HotToastService } from '@ngneat/hot-toast';
import { Subscription } from 'rxjs';
import { UntilDestroy } from '@ngneat/until-destroy';
import { Router } from '@angular/router';
import { OhMyStateService } from '../../services/state.service';
import { uniqueId } from '@shared/utils/unique-id';
import { StorageService } from '../../services/storage.service';

@UntilDestroy({ arrayName: 'subscriptions' })
@Component({
  selector: 'oh-my-json-export',
  templateUrl: './json-export.component.html',
  styleUrls: ['./json-export.component.scss']
})
export class JsonExportComponent implements OnInit {
  state: IOhMyDomain;
  selected: Record<string, IOhMyRequest> = {};
  subscriptions: Subscription[] = [];
  exportList: IOhMyRequest[] = []
  hasRequests: boolean;

  @ViewChild(DataListComponent) dataListRef: DataListComponent;

  constructor(
    private appStateService: AppStateService,
    private stateService: OhMyStateService,
    private storageService: StorageService,
    private toast: HotToastService,
    private router: Router) { }

  ngOnInit(): void {
    this.state = this.stateService.state;
    this.hasRequests = Object.keys(this.state.requests).length > 0;
  }

  onRowExport(data: IOhMyRequest): void {
    if (this.selected[data.id]) {
      delete this.selected[data.id];
    } else {
      this.selected[data.id] = data;
    }
  }

  onSelectAll(): void {
    const hasUnselected = Object.keys(this.state.requests).length -
      Object.keys(this.selected).length > 0;

    if (hasUnselected) { // select all
      this.dataListRef.selectAll();
      this.selected = {};
      Object.values(this.state.requests).forEach(this.onRowExport.bind(this));
    } else { // deselect all
      this.dataListRef.deselectAll();
      this.selected = {};
    }
  }

  async onExport() {
    const count = Object.keys(this.selected).length;
    if (!count) {
      return this.toast.warning('Nothing selected');
    }

    const exportObj = {
      requests: [],
      responses: [],
      version: this.appStateService.version
    }

    for (const r of Object.values(this.selected)) {
      const sMocks = Object.values(r.responses);
      const request = { ...r, id: uniqueId(), mocks: {} };
      // TODO: Fix presets
      // delete request.enabled; // These have presets which belong to a state/domain
      // delete request.selected; // idem
      request.version = this.appStateService.version;

      for (const sm of sMocks) {
        const mock = await this.storageService.get<IOhMyResponse>(sm.id);
        mock.id = uniqueId();
        request.mocks[mock.id] = { ...sm, id: mock.id };

        exportObj.responses.push(mock);
        exportObj.requests.push(request);
      }
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj));

    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", 'oh-my-mock-export.json');
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();

    this.toast.success(`Exported ${count} mocks as 'oh-my-mock-export.json'`);

    setTimeout(() => {
      this.router.navigate(['../']);
    }, 500);
  }

  get selectionCount(): number {
    return this.dataListRef ? this.dataListRef.selection.selected.length : 0;
  }
}
