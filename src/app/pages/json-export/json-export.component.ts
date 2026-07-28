import { Component, OnInit, ViewChild } from '@angular/core';
import { IData, IMock, IOhMyBackup, IOhMyCookie, IOhMyRequests, IOhMyShallowMock, IState } from '@shared/type';
import { StateUtils } from '@shared/utils/state';
import { DataListComponent } from '../../components/data-list/data-list.component';
import { AppStateService } from '../../services/app-state.service';
import { HotToastService } from '@ngxpert/hot-toast';
import { Subscription } from 'rxjs';
import { UntilDestroy } from '@ngneat/until-destroy';
import { Router } from '@angular/router';
import { OhMyStateService } from '../../services/state.service';
import { uniqueId } from '@shared/utils/unique-id';
import { StorageService } from '../../services/storage.service';

@UntilDestroy({ arrayName: 'subscriptions' })
@Component({
  standalone: false,
  selector: 'oh-my-json-export',
  templateUrl: './json-export.component.html',
  styleUrls: ['./json-export.component.scss']
})
export class JsonExportComponent implements OnInit {
  state!: IState;
  selected: Record<string, IData> = {};
  subscriptions: Subscription[] = [];
  exportList: IData[] = []
  hasRequests!: boolean;
  /** This domain's request records, by id — the list renders off these. */
  requests: IOhMyRequests = {};

  @ViewChild(DataListComponent) dataListRef!: DataListComponent;

  constructor(
    private appStateService: AppStateService,
    private stateService: OhMyStateService,
    private storageService: StorageService,
    private toast: HotToastService,
    private router: Router) { }

  ngOnInit(): void {
    this.state = this.stateService.state;
    this.hasRequests = this.state.requests.length > 0;
    this.subscriptions.push(this.stateService.requests$.subscribe(requests => {
      this.requests = StateUtils.pickRequests(this.state, requests);
    }));
  }

  onRowExport(data: IData): void {
    if (this.selected[data.id]) {
      delete this.selected[data.id];
    } else {
      this.selected[data.id] = data;
    }
  }

  onSelectAll(): void {
    const hasUnselected = this.state.requests.length -
      Object.keys(this.selected).length > 0;

    if (hasUnselected) { // select all
      this.dataListRef.selectAll();
      this.selected = {};
      Object.values(this.requests).forEach(r => this.onRowExport(r));
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

    const exportObj: IOhMyBackup = {
      requests: [],
      responses: [],
      version: this.appStateService.version
    }

    for (const r of Object.values(this.selected)) {
      const sMocks = Object.values(r.mocks);
      // enabled/selected are keyed by preset, which belongs to a state, not
      // to an exported request.
      const { enabled, selected, ...rest } = r;
      const request = { ...rest, id: uniqueId(), mocks: {} as Record<string, IOhMyShallowMock> } as IData;
      request.version = this.appStateService.version;

      for (const sm of sMocks) {
        const mock = await this.storageService.get<IMock>(sm.id);
        mock.id = uniqueId();
        request.mocks[mock.id] = { ...sm, id: mock.id };

        exportObj.responses.push(mock);
        exportObj.requests.push(request);
      }
    }

    // Cookie mocks are not attached to a request, so there is nothing in the
    // list to select them with: the domain's cookies go along whole or not at
    // all. Their ids are kept as they are — unlike a request, importing one
    // twice should update it rather than produce a second cookie of the same
    // name.
    for (const id of this.state.cookies ?? []) {
      const cookie = await this.storageService.get<IOhMyCookie>(id);

      if (cookie) {
        exportObj.cookies = [...(exportObj.cookies ?? []), cookie];
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
