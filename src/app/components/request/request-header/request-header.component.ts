import { Component, Input, OnChanges, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { IOhMyRequest, IOhMyContext, IOhMyShallowResponse, IOhMyDomain, IOhMyStatusCode, IOhMyResponseId, IOhMyNewResponseStatusCode, IOhMyDomainContext } from '@shared/types';
import { CreateStatusCodeComponent } from '../../../components/create-response/create-status-code.component';
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
  @Input() request: IOhMyRequest;
  @Input() context: IOhMyDomainContext;

  public statusCode: IOhMyStatusCode;
  public mockIds: IOhMyResponseId[];
  public methodCtrl = new UntypedFormControl(null, { updateOn: 'blur' });
  public filteredMethodOptions: Observable<string[]>;
  public typeCtrl = new UntypedFormControl(null, { updateOn: 'blur' });
  public filteredTypeOptions: Observable<string[]>;
  public urlCtrl = new UntypedFormControl(null, { updateOn: 'blur' });
  public presetInfo = presetInfo;

  public oldResponses: string[];

  public availableMethods = METHODS;
  subscriptions: Subscription[] = [];
  state: IOhMyDomain;

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
      if (method !== this.request.requestMethod) {
        this.storeService.upsertRequest({
          id: this.request.id, requestMethod: method,
        }, this.context)
      }
    });

    // TODO: THis does not exist anymore
    // this.typeCtrl.valueChanges.subscribe(type => {
    //   if (type !== this.request.requestType) {
    //     this.storeService.upsertRequest({
    //       id: this.request.id, requestType: type
    //     }, this.context)
    //   }
    // });

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
      ? Object.keys(this.request.responses).sort((a, b) => {
        const ma = this.request.responses[a];
        const mb = this.request.responses[b];

        return ma.statusCode === mb.statusCode ? 0 : ma.statusCode > mb.statusCode ? 1 : -1;
      }) : [];

    this.methodCtrl.setValue(this.request.requestMethod);
    // this.typeCtrl.setValue(this.request.requestType);
    this.urlCtrl.setValue(this.request.url);
  }

  onSelectStatusCode(responseId: IOhMyResponseId): void {
    const preset = { ...this.request.presets[this.context.presetId], responseId };
    const presets = { ...this.request.presets, [this.context.presetId]: preset };

    this.storeService.upsertRequest({ ...this.request, presets: { ...presets } }, this.context);
  }

  onDisableRequest(): void {
    const presets = { ...this.request.presets };
    presets[this.context.presetId] = { ...presets[this.context.presetId], isActive: false };

    this.storeService.upsertRequest({ ...this.request, presets }, this.context);
  }

  openAddResponseDialog(): void {
    const dialogRef = this.dialog.open<CreateStatusCodeComponent, IOhMyDomain, IOhMyNewResponseStatusCode>(CreateStatusCodeComponent, {
      width: '280px',
      height: '380px',
      data: this.state
    });

    dialogRef.afterClosed().subscribe(async (update: IOhMyNewResponseStatusCode) => {
      if (!update) {
        return;
      }

      const isClone = update.clone;
      delete update.clone;

      if (isClone) {
        this.storeService.cloneResponse(
          this.request.presets[this.context.presetId].responseId,
          update, this.request, this.context);
      } else {
        this.storeService.upsertResponse(update, this.request, this.context);
      }
    });
  }

  onMethodBlur(): void {
    const method = (this.methodCtrl.value || '').toUpperCase();

    // if (method !== this.data.method) {
    //   this.upsertData({ ...this.data, method });
    // }
  }

  getMock(id: IOhMyResponseId): IOhMyShallowResponse {

    return this.request.responses[id];
  }

  onMethodChange(event): void {
  }
}
