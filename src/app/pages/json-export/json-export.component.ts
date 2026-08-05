import { Component, OnInit, ViewChild, inject } from '@angular/core';
import {
  IData,
  IMock,
  IOhMyBackup,
  IOhMyCookie,
  IOhMyRequests,
  IOhMyShallowMock,
  IState
} from '@shared/type';
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
import { MatMiniFabButton, MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatBadge } from '@angular/material/badge';

@UntilDestroy({ arrayName: 'subscriptions' })
@Component({
  selector: 'oh-my-json-export',
  templateUrl: './json-export.component.html',
  styleUrls: ['./json-export.component.scss'],
  imports: [MatMiniFabButton, MatIcon, DataListComponent, MatButton, MatBadge]
})
export class JsonExportComponent implements OnInit {
  private appStateService = inject(AppStateService);
  private stateService = inject(OhMyStateService);
  private storageService = inject(StorageService);
  private toast = inject(HotToastService);
  private router = inject(Router);

  state!: IState;
  selected: Record<string, IData> = {};
  subscriptions: Subscription[] = [];
  exportList: IData[] = [];
  hasRequests!: boolean;
  /** This domain's request records, by id — the list renders off these. */
  requests: IOhMyRequests = {};

  @ViewChild(DataListComponent) dataListRef!: DataListComponent;

  ngOnInit(): void {
    this.state = this.stateService.state;
    this.hasRequests = this.state.requests.length > 0;
    this.subscriptions.push(
      this.stateService.requests$.subscribe((requests) => {
        this.requests = StateUtils.pickRequests(this.state, requests);
      })
    );
  }

  onRowExport(data: IData): void {
    if (this.selected[data.id]) {
      delete this.selected[data.id];
    } else {
      this.selected[data.id] = data;
    }
  }

  onSelectAll(): void {
    const hasUnselected =
      this.state.requests.length - Object.keys(this.selected).length > 0;

    if (hasUnselected) {
      // select all
      this.dataListRef.selectAll();
      this.selected = {};
      Object.values(this.requests).forEach((r) => this.onRowExport(r));
    } else {
      // deselect all
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
      // The presets travel with the backup: `selected` and `enabled` on each
      // request below are keyed by preset id, and without this id-to-label map
      // the importer could not tell one preset from another — which is how a
      // backup used to lose every per-preset choice. Exported whole, like the
      // cookies further down: a preset belongs to the domain, not to any one
      // selected request.
      presets: { ...this.state.presets },
      version: this.appStateService.version
    };

    for (const r of Object.values(this.selected)) {
      const sMocks = Object.values(r.mocks);
      // Responses get fresh ids in the file, so `selected` — which points at
      // response ids — is remapped through this before the request is written.
      const responseIds: Record<string, string> = {};
      const request: IData = {
        ...r,
        enabled: { ...r.enabled },
        selected: {},
        id: uniqueId(),
        mocks: {} as Record<string, IOhMyShallowMock>,
        version: this.appStateService.version
      };

      // `calledAt` means "this browser intercepted this request" and only the
      // interception may write it (see `IData.calledAt`). Wherever this backup
      // ends up, that browser has not called anything — exporting the field
      // would make an imported request claim traffic that never happened there.
      delete request.calledAt;

      for (const sm of sMocks) {
        const mock = await this.storageService.get<IMock>(sm.id);

        // A shallow entry can outlive its record, and `get` answers
        // `undefined` for the id it left behind. The cookie loop below already
        // survives that; here it used to throw, killing the whole export with
        // nothing shown. One orphaned id is no reason to hold every healthy
        // request hostage — the entry is simply not exported.
        if (!mock) {
          continue;
        }

        mock.id = uniqueId();
        responseIds[sm.id] = mock.id;
        request.mocks[mock.id] = { ...sm, id: mock.id };

        exportObj.responses.push(mock);
      }

      for (const [presetId, mockId] of Object.entries(r.selected)) {
        const remapped = responseIds[mockId];

        // A selection pointing at a response that was not exported (the
        // orphan case above) is dropped; the importer reselects a default.
        if (remapped) {
          request.selected[presetId] = remapped;
        }
      }

      // Once per request, not once per response: pushing inside the loop above
      // wrote a request with N responses N times over, and a request with no
      // responses yet not at all — it silently vanished from the backup.
      exportObj.requests.push(request);
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

    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(exportObj));

    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', 'oh-my-mock-export.json');
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
