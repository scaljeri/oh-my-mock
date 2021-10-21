import { Component, EventEmitter, Input, OnChanges, OnInit, Output } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { IData, IMock, IOhMyPresets, IOhMyShallowMock, IState, IStore, IUpsertMock, ohMyMockId, ohMyPresetId, statusCode } from '@shared/type';
import { CreateStatusCodeComponent } from 'src/app/components/create-response/create-status-code.component';
import { NgApiMockCreateMockDialogWrapperComponent } from 'src/app/plugins/ngapimock/dialog/ng-api-mock-create-mock-dialog-wrapper/ng-api-mock-create-mock-dialog-wrapper.component';
// import { findAutoActiveMock } from '../../../utils/data';
import { UpsertData, UpsertMock } from 'src/app/store/actions';
import { FormControl } from '@angular/forms';
import { Observable, Subscription } from 'rxjs';
import { METHODS, STORAGE_KEY } from '@shared/constants';
import { Store } from '@ngxs/store';
import { OhMyState } from 'src/app/store/state';
import { UntilDestroy } from '@ngneat/until-destroy';
import { StateStreamService } from 'src/app/services/state-stream.service';
import { presetInfo } from '../../../constants';
import { DataUtils } from '@shared/utils/data';
import { ContextService } from 'src/app/services/context.service';

@UntilDestroy({ arrayName: 'subscriptions' })
@Component({
  selector: 'app-mock-header',
  templateUrl: './mock-header.component.html',
  styleUrls: ['./mock-header.component.scss']
})
export class MockHeaderComponent implements OnInit, OnChanges {
  @Input() data: IData;
  @Input() presets: IOhMyPresets;
  @Input() domain: string;

  @Output() mockActivated = new EventEmitter();

  public statusCode: statusCode;
  public mockIds: ohMyMockId[];
  public methodCtrl = new FormControl(null, { updateOn: 'blur' });
  public filteredMethodOptions: Observable<string[]>;
  public typeCtrl = new FormControl(null, { updateOn: 'blur' });
  public filteredTypeOptions: Observable<string[]>;
  public urlCtrl = new FormControl(null, { updateOn: 'blur' });
  public presetInfo = presetInfo;

  public oldResponses: string[];

  public availableMethods = METHODS;
  scenarios: IOhMyPresets;
  subscriptions: Subscription[] = [];
  state: IState;

  @Dispatch() upsertMock = (mock: Partial<IMock>, clone: ohMyMockId | undefined) => {
    debugger;
    return new UpsertMock({ id: this.data.id, clone, makeActive: true, mock }, this.domain);
  }
  @Dispatch() upsertData = (data: Partial<IData>) => {
    return new UpsertData({ ...this.data, ...data }, this.domain);
  }

  constructor(
    private context: ContextService,
    public dialog: MatDialog,
    private stateStream: StateStreamService) {
    this.subscriptions.push(this.stateStream.state$.subscribe(state => {
      this.state = state;
    }));
  }

  ngOnInit(): void {
    // setTimeout(() => {
    //   if (!this.data.activeMock && Object.keys(this.data.mocks).length > 0) {
    //     // this.onSelectStatusCode(findAutoActiveMock(this.data));
    //   }
    // });

    this.methodCtrl.valueChanges.subscribe(val => {
      const method = (val || '').toUpperCase();
      if (method !== this.data.method) {
        this.upsertData({ method });
      }
    });

    this.typeCtrl.valueChanges.subscribe(type => {
      if (type !== this.data.requestType) {
        this.upsertData({ requestType: type });
      }
    });

    this.methodCtrl.setValue(this.data.method);
    this.typeCtrl.setValue(this.data.requestType);
    this.urlCtrl.setValue(this.data.url);
  }

  ngOnChanges(): void {
    this.mockIds = this.data
      ? Object.keys(this.data.mocks).sort((a, b) => {
        const ma = this.data.mocks[a];
        const mb = this.data.mocks[b];

        return ma.statusCode === mb.statusCode ? 0 : ma.statusCode > mb.statusCode ? 1 : -1;
      }) : [];
  }

  onUrlUpdate(url: string): void {
    this.upsertData({ url });
  }

  onSelectStatusCode(mockId: ohMyMockId | void): void {
    if (mockId) {
      this.mockActivated.emit(mockId);
      // this.upsertData({ activeMock: mockId, enabled: true })
    } else {
      this.mockActivated.emit();
      // this.upsertData({ enabled: false })
    }
  }

  openAddResponseDialog(): void {
    const dialogRef = this.dialog.open(CreateStatusCodeComponent, {
      width: '280px',
      height: '380px',
      data: this.state
    });

    dialogRef.afterClosed().subscribe((update: IUpsertMock) => {
      if (!update) {
        return;
      }

      this.upsertMock(update.mock, DataUtils.getSelectedResponse(this.data, this.context)?.id);
    });
  }

  exportNgApiMock(): void {
    this.dialog.open(NgApiMockCreateMockDialogWrapperComponent, {
      data: this.data
    });
  }

  onMethodBlur(): void {
    const method = (this.methodCtrl.value || '').toUpperCase();

    // if (method !== this.data.method) {
    //   this.upsertData({ ...this.data, method });
    // }
  }

  getMock(id: ohMyMockId): IOhMyShallowMock {

    return this.data.mocks[id];
  }

  onMethodChange(event): void {
  }
}
