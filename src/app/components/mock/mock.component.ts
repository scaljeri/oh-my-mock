import {
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { DeleteMock, LoadMock, UpsertData, UpsertMock } from 'src/app/store/actions';
import { IData, IMock, IOhMyMockRule, ohMyMockId, ohMyDataId, IOhMyShallowMock, ohMyPresetId, IOhMyContext } from '@shared/type';
import { filter, map, Observable, Subscription, tap } from 'rxjs';
import { IOhMyCodeEditOptions } from '../form/code-edit/code-edit';
import { AnonymizeComponent } from '../anonymize/anonymize.component';
import { HotToastService } from '@ngneat/hot-toast';
import { UntilDestroy } from '@ngneat/until-destroy';
import { extractMimeType, isMimeTypeJSON } from '@shared/utils/mime-type';
import { FormControl } from '@angular/forms';
import { DialogCodeEditorComponent } from '../dialog/code-editor/code-editor.component';
import { StateStreamService } from 'src/app/services/state-stream.service';

@UntilDestroy({ arrayName: 'subscriptions' })
@Component({
  selector: 'oh-my-mock',
  templateUrl: './mock.component.html',
  styleUrls: ['./mock.component.scss']
})
export class MockComponent implements OnChanges, OnDestroy {
  @Input() requestId: ohMyDataId;
  @Input() context: IOhMyContext;
  response: IMock;

  // @Select(OhMyState.mock) state$: Observable<IState>;

  @Dispatch() loadMock = (smock: IOhMyShallowMock) => new LoadMock(smock);
  @Dispatch() upsertMock = (mock: Partial<IMock>) => {
    debugger;
    return new UpsertMock({
      id: this.requestId,
      makeActive: true,
      mock
    }, this.context);
  };
  @Dispatch() upsertData = (data: Partial<IData>) => new UpsertData(data, this.context);
  @Dispatch() deleteMockResponse = (id: ohMyDataId, mockId: ohMyMockId) => {
    return new DeleteMock({ id, mockId }, this.context);
  }

  public dialogIsOpen = false;

  subscriptions = new Subscription();

  activeMock$: Observable<IMock>;
  responseType: string;

  responseCtrl = new FormControl(null, { updateOn: 'blur' });
  headersCtrl = new FormControl(null, { updateOn: 'blur' });
  hasMocks = false;

  responseId: ohMyMockId;
  request: IData;

  constructor(
    private stateStream: StateStreamService,
    public dialog: MatDialog,
    private toast: HotToastService,
    private cdr: ChangeDetectorRef) {
  }

  ngOnInit(): void {
    this.subscriptions.add(this.stateStream.state$.subscribe(state => {
      this.context = state.context;
      this.request = state.data[this.requestId];
      this.hasMocks = Object.keys(this.request.mocks).length > 0;

      if (this.request.enabled[this.context.preset]) {
        const responseId = this.request.selected[this.context.preset];

        if (responseId !== this.responseId) {
          this.responseId = responseId;
          this.loadMock(this.request.mocks[responseId]); // This will always trigger the subscription below
        }
      } else {
        this.responseId = undefined;
        this.response = undefined;
      }
    }));

    this.subscriptions.add(this.stateStream.responses$.pipe(
      map(responses => responses[this.responseId]), filter(r => !!r))
      .subscribe(response => {
        this.response = response;
        this.responseType = isMimeTypeJSON(this.response?.headersMock?.['content-type']) ? 'json' : '';

        this.responseCtrl.setValue(response.responseMock, { emitEvent: false });
        this.headersCtrl.setValue(response.headersMock, { emitEvent: false });
      }));

    // this.subscriptions.push(this.activeMock$.subscribe(mock => {
    //   this.mock = mock;

    //   this.responseCtrl.setValue(mock?.responseMock, { emitEvent: false });
    //   this.headersCtrl.setValue(mock?.headersMock, { emitEvent: false });
    // }));


    this.responseCtrl.valueChanges.subscribe(val => {
      // this.responseCtrl.setValue(val, { emitEvent: false });
      this.upsertMock({ id: this.response.id, responseMock: val });
    });

    this.headersCtrl.valueChanges.subscribe(val => {
      // this.headersCtrl.setValue(val, { emitEvent: false });
      this.onHeadersChange(val);
    });
  }

  ngOnChanges(): void {
    // if (this.activeMockId && this.activeMockId !== this.response?.id) {
    //   this.response = null;
    //   this.loadMock(this.data.mocks[this.activeMockId]);
    //   this.responseType = isMimeTypeJSON(this.response?.headersMock?.['content-type']) ? 'json' : '';
    // }

    // this.hasMocks = Object.keys(this.data.mocks).length > 0;
  }

  onDelete(): void {
    this.deleteMockResponse(this.requestId, this.response.id);
  }

  onRevertResponse(): void {
    this.upsertMock({ id: this.response.id, responseMock: this.response.response });
    this.cdr.detectChanges();
  }

  onHeadersChange(headersMock: string): void {
    try {
        this.upsertMock({
          id: this.response.id,
          headersMock: JSON.parse(headersMock)
        });
    } catch (err) {
    }
  }

  onRevertHeaders(): void {
    this.upsertMock({ id: this.response.id, headersMock: this.response.headers });
    this.cdr.detectChanges();
  }

  onMockActivated(mockId: ohMyMockId) {
    // this.activeMockId = mockId;

    // TODO
    // if (!mockId) {
    //   this.mock = null;
    //   return this.upsertData({
    //     id: this.data.id,
    //     enabled: { ...this.data.enabled, [this.sccenario]: false }});
    // } else {
    //   this.upsertData({ id: this.data.id, enabled: { ...this.data.enabled, [this.sccenario]: false }});
    // }
  }

  openShowMockCode(): void {
    const data = { code: this.response.jsCode, type: 'javascript', allowErrors: false };

    this.openCodeDialog(data, (update: string) => {
      this.upsertMock({ id: this.response.id, jsCode: update });
    });
  }

  onShowResponseFullscreen(): void {
    const data = {
      code: this.response.responseMock,
      type: extractMimeType(this.response.headersMock?.['content-type'])
    };

    this.openCodeDialog(data, (update: string) => {
      // this.responseCtrl.setValue(update, { emitEvent: false });
      this.upsertMock({ id: this.response.id, responseMock: update });
    });
  }

  onShowHeadersFullscreen(): void {
    const data = { code: this.response.headersMock, type: 'json', allowErrors: false };
    this.openCodeDialog(data, (update: string) => {
      const headers = JSON.parse(update);
      // this.headersCtrl.setValue(headers, { emitEvent: false });
      this.upsertMock({ id: this.response.id, headersMock: headers });
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
        this.upsertMock({
          id: this.response.id,
          ...(update.data && { responseMock: update.data }),
          rules: update.rules
        });

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
