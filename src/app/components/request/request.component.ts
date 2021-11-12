import {
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { IData, IMock, IOhMyMockRule, IOhMyContext } from '@shared/type';
import { filter, Observable, Subscription } from 'rxjs';
import { IOhMyCodeEditOptions } from '../form/code-edit/code-edit';
import { AnonymizeComponent } from '../anonymize/anonymize.component';
import { HotToastService } from '@ngneat/hot-toast';
import { UntilDestroy } from '@ngneat/until-destroy';
import { extractMimeType, isMimeTypeJSON } from '@shared/utils/mime-type';
import { FormControl } from '@angular/forms';
import { DialogCodeEditorComponent } from '../dialog/code-editor/code-editor.component';
import { OhMyStateService } from 'src/app/services/state.service';
import { OhMyState } from 'src/app/services/oh-my-store';
import { StorageService } from 'src/app/services/storage.service';
import { IS_BASE64_RE } from '@shared/constants';

@UntilDestroy({ arrayName: 'subscriptions' })
@Component({
  selector: 'oh-my-request',
  templateUrl: './request.component.html',
  styleUrls: ['./request.component.scss']
})
export class RequestComponent implements OnChanges, OnDestroy {
  @Input() request: IData;
  @Input() context: IOhMyContext;
  @Input() blurImages = false;

  response: IMock;

  public dialogIsOpen = false;

  subscriptions = new Subscription();

  activeMock$: Observable<IMock>;
  responseType: string;

  responseCtrl = new FormControl(null, { updateOn: 'blur' });
  headersCtrl = new FormControl(null, { updateOn: 'blur' });
  hasMocks = false;
  isResponseImage = false;

  constructor(
    private storeService: OhMyState,
    private stateService: OhMyStateService,
    public dialog: MatDialog,
    private toast: HotToastService,
    private storageService: StorageService,
    private cdr: ChangeDetectorRef) {
  }

  ngOnInit(): void {
    this.subscriptions.add(this.stateService.response$.pipe(filter(r => r && r.id === this.response?.id))
      .subscribe(r => {
        this.response = r;
        this.responseCtrl.setValue(r.responseMock, { emitEvent: false });
        this.headersCtrl.setValue(r.headersMock, { emitEvent: false });
      }));

    this.responseCtrl.valueChanges.subscribe(val => {
      this.storeService.upsertResponse({ responseMock: val, id: this.response.id }, this.request, this.context);
    });

    this.headersCtrl.valueChanges.subscribe(val => {
      this.onHeadersChange(val);
    });
  }

  async ngOnChanges(): Promise<void> {
    const activeResponse = this.request?.mocks[this.request?.selected[this.context.preset]];

    if (!activeResponse) {
      return;
    }

    if (this.response?.id !== activeResponse.id) {
      this.response = await this.storageService.get(activeResponse.id);

      if (!this.response) {
        return;
      }

      this.responseType = isMimeTypeJSON(this.response?.headersMock?.['content-type']) ? 'json' : '';
      this.hasMocks = Object.keys(this.request.mocks).length > 0;

      this.responseCtrl.setValue(this.response.responseMock, { emitEvent: false });
      this.headersCtrl.setValue(this.response.headersMock, { emitEvent: false });
      if (this.response.responseMock.match(IS_BASE64_RE) && this.response.headersMock['content-type'].match(/image/)) {
        this.isResponseImage = true;
      }
    }
  }

  onDelete(): void {
    this.storeService.deleteResponse(this.response.id, this.request.id, this.context);
  }

  onRevertResponse(): void {
    this.storeService.upsertResponse({ responseMock: this.response.response, id: this.response.id }, this.request, this.context);
  }

  onHeadersChange(headersMock: string): void {
    try {
      this.storeService.upsertResponse({
        id: this.response.id,
        headersMock: JSON.parse(headersMock)
      }, this.request, this.context);
    } catch (err) {
      // TODO
    }
  }

  onRevertHeaders(): void {
    this.storeService.upsertResponse({ headersMock: this.response.headers, id: this.response.id }, this.request, this.context);
  }

  openShowMockCode(): void {
    const data = { code: this.response.jsCode, type: 'javascript', allowErrors: false };

    this.openCodeDialog(data, (update: string) => {
      this.storeService.upsertResponse({ jsCode: update, id: this.response.id }, this.request, this.context);
    });
  }

  onShowResponseFullscreen(): void {
    const data = {
      code: this.response.responseMock,
      type: extractMimeType(this.response.headersMock?.['content-type'])
    };

    this.openCodeDialog(data, (update: string) => {
      this.storeService.upsertResponse({
        responseMock: update, id: this.response.id
      }, this.request, this.context);
    });
  }

  onShowHeadersFullscreen(): void {
    const data = { code: this.response.headersMock, type: 'json', allowErrors: false };
    this.openCodeDialog(data, (update: string) => {
      this.onHeadersChange(update);
    });
  }

  onAnonymize() {
    if (!isMimeTypeJSON(this.response.headersMock?.['content-type'])) {
      return this.toast.error('Content-Type should be JSON');
    }

    this.dialogIsOpen = true;

    const dialogRef = this.dialog.open(AnonymizeComponent, {
      width: '80%',
      maxHeight: '90hv',
      panelClass: 'scrollable-dialog',
      data: this.response
    });

    dialogRef.afterClosed().subscribe((update: { data: string, rules: IOhMyMockRule[] }) => {
      this.dialogIsOpen = false;

      if (update) {
        // this.upsertMock({
        //   id: this.response.id,
        //   ...(update.data && { responseMock: update.data }),
        //   rules: update.rules
        // });

        // setTimeout(() => {
        //   this.responseRef?.update();
        // });
      }
    });
  }

  openCodeDialog(data: IOhMyCodeEditOptions, cb: (update: string) => void): void {
    this.dialogIsOpen = true;
    const dialogRef = this.dialog.open(DialogCodeEditorComponent, {
      width: '80%',
      data
    });

    dialogRef.afterClosed().subscribe(update => {
      this.dialogIsOpen = false;
      if (update) {
        cb(update);
      }
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
