import { Component, Input, OnChanges, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { IData, IOhMyContext, IOhMyShallowMock, IState, IUpsertMock, ohMyMockId, statusCode } from '@shared/type';
import { CreateStatusCodeComponent } from '../../../components/create-response/create-status-code.component';
import { NgApiMockCreateMockDialogWrapperComponent } from '../../../plugins/ngapimock/dialog/ng-api-mock-create-mock-dialog-wrapper/ng-api-mock-create-mock-dialog-wrapper.component';
// import { findAutoActiveMock } from '../../../utils/data';
import { UntypedFormControl } from '@angular/forms';
import { Observable, Subscription } from 'rxjs';
import { METHODS } from '@shared/constants';
import { UntilDestroy } from '@ngneat/until-destroy';
import { presetInfo } from '../../../constants';
import { OhMyState } from '../../../services/oh-my-store';
// import { OhMyStateService } from 'src/app/services/state.service';

@UntilDestroy({ arrayName: 'subscriptions' })
@Component({
  selector: 'oh-request-header',
  templateUrl: './request-header.component.html',
  styleUrls: ['./request-header.component.scss']
})
export class RequestHeaderComponent implements OnInit, OnChanges {
  @Input() request: IData;
  @Input() context: IOhMyContext;

  public statusCode: statusCode;
  public mockIds: ohMyMockId[];
  public methodCtrl = new UntypedFormControl(null, { updateOn: 'blur' });
  public filteredMethodOptions: Observable<string[]>;
  public typeCtrl = new UntypedFormControl(null, { updateOn: 'blur' });
  public filteredTypeOptions: Observable<string[]>;
  public urlCtrl = new UntypedFormControl(null, { updateOn: 'blur' });
  public presetInfo = presetInfo;

  public oldResponses: string[];

  public availableMethods = METHODS;
  subscriptions: Subscription[] = [];
  state: IState;

  constructor(
    public dialog: MatDialog,
    private storeService: OhMyState) { }

  ngOnInit(): void {
    // setTimeout(() => {
    //   if (!this.data.activeMock && Object.keys(this.data.mocks).length > 0) {
    //     // this.onSelectStatusCode(findAutoActiveMock(this.data));
    //   }
    // });

    this.methodCtrl.valueChanges.subscribe(val => {
      const method = (val || '').toUpperCase();
      if (method !== this.request.method) {
        this.storeService.upsertRequest({
          id: this.request.id, method
        }, this.context)
      }
    });

    this.typeCtrl.valueChanges.subscribe(type => {
      if (type !== this.request.requestType) {
        this.storeService.upsertRequest({
          id: this.request.id, requestType: type
        }, this.context)
      }
    });

    this.urlCtrl.valueChanges.subscribe(url => {
      if (url !== this.request.url) {
        this.storeService.upsertRequest({
          id: this.request.id, url: url
        }, this.context)
      }
    });
  }

  ngOnChanges(): void {
    this.mockIds = this.request
      ? Object.keys(this.request.mocks).sort((a, b) => {
        const ma = this.request.mocks[a];
        const mb = this.request.mocks[b];

        return ma.statusCode === mb.statusCode ? 0 : ma.statusCode > mb.statusCode ? 1 : -1;
      }) : [];

    this.methodCtrl.setValue(this.request.method);
    this.typeCtrl.setValue(this.request.requestType);
    this.urlCtrl.setValue(this.request.url);
  }

  onSelectStatusCode(mockId: ohMyMockId): void {
    const enabled = { ...this.request.enabled, [this.context.preset]: true };
    const selected = { ...this.request.selected, [this.context.preset]: mockId };

    this.storeService.upsertRequest({ ...this.request, enabled, selected }, this.context);
  }

  onDisableRequest(): void {
    const enabled = { ...this.request.enabled, [this.context.preset]: false };
    this.storeService.upsertRequest({ ...this.request, enabled }, this.context);
  }

  openAddResponseDialog(): void {
    const dialogRef = this.dialog.open(CreateStatusCodeComponent, {
      width: '280px',
      height: '380px',
      data: this.state
    });

    dialogRef.afterClosed().subscribe(async (update: IUpsertMock) => {
      if (!update) {
        return;
      }

      if (update.clone) {
        this.storeService.cloneResponse(
          this.request.selected[this.context.preset],
          update.mock, this.request, this.context);
      } else {
        this.storeService.upsertResponse(update.mock, this.request, this.context);
      }
    });
  }

  exportNgApiMock(): void {
    this.dialog.open(NgApiMockCreateMockDialogWrapperComponent, {
      data: this.request
    });
  }

  onMethodBlur(): void {
    const method = (this.methodCtrl.value || '').toUpperCase();

    // if (method !== this.data.method) {
    //   this.upsertData({ ...this.data, method });
    // }
  }

  getMock(id: ohMyMockId): IOhMyShallowMock {

    return this.request.mocks[id];
  }

  onMethodChange(event): void {
  }
}
