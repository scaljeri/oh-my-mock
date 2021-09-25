import {
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { DeleteMock, LoadMock, UpsertData, UpsertMock } from 'src/app/store/actions';
import { IData, IMock, IOhMyMockRule, ohMyMockId, ohMyDataId, IOhMyShallowMock } from '@shared/type';
import { Observable, Subscription } from 'rxjs';
import { IOhMyCodeEditOptions } from '../form/code-edit/code-edit';
import { AnonymizeComponent } from '../anonymize/anonymize.component';
import { HotToastService } from '@ngneat/hot-toast';
import { Store } from '@ngxs/store';
import { UntilDestroy } from '@ngneat/until-destroy';
import { STORAGE_KEY } from '@shared/constants';
import { extractMimeType, isMimeTypeJSON } from '@shared/utils/mime-type';
import { FormControl } from '@angular/forms';
import { DialogCodeEditorComponent } from '../dialog/code-editor/code-editor.component';

@UntilDestroy({ arrayName: 'subscriptions' })
@Component({
  selector: 'oh-my-mock',
  templateUrl: './mock.component.html',
  styleUrls: ['./mock.component.scss']
})
export class MockComponent implements OnChanges {
  @Input() data: IData;
  @Input() domain: string;
  mock: IMock;

  // @Select(OhMyState.mock) state$: Observable<IState>;

  @Dispatch() loadMock = (smock: IOhMyShallowMock) => new LoadMock(smock);
  @Dispatch() upsertMock = (mock: Partial<IMock>) => {
    return new UpsertMock({
      id: this.data.id,
      makeActive: true,
      mock
    }, this.domain);
  };
  @Dispatch() upsertData = (data: Partial<IData>) => new UpsertData(data);
  @Dispatch() deleteMockResponse = (id: ohMyDataId, mockId: ohMyMockId) => {
    return new DeleteMock({ id, mockId });
  }

  public dialogIsOpen = false;
  private activeMockId: ohMyMockId;

  subscriptions: Subscription[] = [];

  activeMock$: Observable<IMock>;
  responseType: string;

  // @ViewChild('response') responseRef: CodeEditComponent;
  // @ViewChild('headers') headersRef: CodeEditComponent;
  responseCtrl = new FormControl(null, { updateOn: 'blur' });
  headersCtrl = new FormControl(null, { updateOn: 'blur' });

  constructor(
    private store: Store,
    public dialog: MatDialog,
    private toast: HotToastService,
    private cdr: ChangeDetectorRef) {
    this.activeMock$ = this.store.select(state => {
      // TODO: is `unsubscribe` needed?
      return this.activeMockId ? state[STORAGE_KEY].content.mocks[this.activeMockId] : null;
    });
  }

  ngOnInit(): void {
    this.subscriptions.push(this.activeMock$.subscribe(mock => {
      console.log('new moc', mock);
      this.mock = mock;

      this.responseCtrl.setValue(mock?.responseMock, { emitEvent: false });
      this.headersCtrl.setValue(mock?.headersMock, { emitEvent: false });
    }));


    this.responseCtrl.valueChanges.subscribe(val => {
      this.upsertMock({ id: this.mock.id, responseMock: val });
    });

    this.headersCtrl.valueChanges.subscribe(val => {
      this.onHeadersChange(val);
    });
  }

  ngOnChanges(): void {
    this.activeMockId = this.data.activeMock;

    if (this.activeMockId !== this.mock?.id) {
      this.mock = null;
      this.loadMock(this.data.mocks[this.activeMockId]);
      this.responseType = isMimeTypeJSON(this.mock?.headersMock?.['content-type']) ? 'json' : '';
    }
  }

  onDelete(): void {
    this.deleteMockResponse(this.data.id, this.mock.id);
  }

  onRevertResponse(): void {
    this.upsertMock({ id: this.mock.id, responseMock: this.mock.response });
    this.cdr.detectChanges();
  }

  onHeadersChange(headersMock: string): void {
    try {
      if (JSON.parse(headersMock) && headersMock !== JSON.stringify(this.mock.headersMock || {})) {
        this.upsertMock({
          id: this.mock.id,
          headersMock: JSON.parse(headersMock)
        });
        this.cdr.detectChanges();
      }
    } catch (err) {
    }
  }

  onRevertHeaders(): void {
    this.upsertMock({ id: this.mock.id, headersMock: this.mock.headers });
    this.cdr.detectChanges();
  }

  onMockActivated(mockId: ohMyMockId) {
    this.activeMockId = mockId;

    if (!mockId) {
      this.mock = null;
      return this.upsertData({ id: this.data.id, enabled: false });
    }

    if (mockId !== this.data.activeMock || !this.data.enabled) {
      this.upsertData({ id: this.data.id, enabled: true, activeMock: mockId });
    }
  }

  openShowMockCode(): void {
    const data = { code: this.mock.jsCode, type: 'javascript', allowErrors: false };

    this.openCodeDialog(data, (update: string) => {
      this.upsertMock({ id: this.mock.id, jsCode: update });
    });
  }

  onShowResponseFullscreen(): void {
    const data = {
      code: this.mock.responseMock,
      type: extractMimeType(this.mock.headersMock?.['content-type'])
    };

    this.openCodeDialog(data, (update: string) => {
      this.upsertMock({ id: this.mock.id, responseMock: update });
      // setTimeout(() => {
      //   this.responseRef.update();
      // });
    });
  }

  onShowHeadersFullscreen(): void {
    const data = { code: this.mock.headersMock, type: 'json', allowErrors: false };
    this.openCodeDialog(data, (update: string) => {
      this.upsertMock({ id: this.mock.id, headersMock: JSON.parse(update) });
      // setTimeout(() => {
      //   this.headersRef.update();
      // });
    });
  }

  onAnonymize() {
    if (!isMimeTypeJSON(this.mock.headersMock?.['content-type'])) {
      return this.toast.error('Content-Type should be JSON');
    }

    this.dialogIsOpen = true;

    const dialogRef = this.dialog.open(AnonymizeComponent, {
      width: '80%',
      maxHeight: '90hv',
      panelClass: 'scrollable-dialog',
      data: this.mock
    });

    dialogRef.afterClosed().subscribe((update: { data: string, rules: IOhMyMockRule[] }) => {
      this.dialogIsOpen = false;

      if (update) {
        this.upsertMock({
          id: this.mock.id,
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
}
