import {
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { IData, IMock, IOhMyMockRule, IOhMyContext } from '@shared/type';
import { filter, Observable, Subscription } from 'rxjs';
import { IOhMyCodeEditOptions } from '../form/code-edit/code-edit';
import { AnonymizeComponent } from '../anonymize/anonymize.component';
import { HotToastService } from '@ngxpert/hot-toast';
import { UntilDestroy } from '@ngneat/until-destroy';
import { extractMimeType, isMimeTypeJSON } from '@shared/utils/mime-type';
import { UntypedFormControl } from '@angular/forms';
import { DialogCodeEditorComponent } from '../dialog/code-editor/code-editor.component';
import { OhMyStateService } from '../../services/state.service';
import { OhMyState } from '../../services/oh-my-store';
import { StorageService } from '../../services/storage.service';
import { activeMockId } from './active-mock';

/** The three editors the detail pane switches between. */
export type OhMyDetailTab = 'Body' | 'Headers' | 'Code';

export const OH_MY_DETAIL_TABS: ReadonlyArray<OhMyDetailTab> = ['Body', 'Headers', 'Code'];

@UntilDestroy({ arrayName: 'subscriptions' })
@Component({
  standalone: false,
  selector: 'oh-my-request',
  templateUrl: './request.component.html',
  styleUrls: ['./request.component.scss']
})
export class RequestComponent implements OnInit, OnChanges, OnDestroy {
  @Input() request!: IData;
  @Input() context!: IOhMyContext;
  @Input() blurImages = false;

  /** Shown in the footer, as `Preset: <name>` in the design. */
  @Input() presetName = '';

  response: IMock | undefined;

  /**
   * The response currently on display.
   *
   * `response` is undefined while no mock is active, but the template wraps the
   * whole detail card in `*ngIf="response"`, so every handler below can only
   * fire once one is shown. Asserting that here keeps the assertion in one
   * documented place instead of at each call site.
   */
  private get shownResponse(): IMock {
    return this.response as IMock;
  }

  public dialogIsOpen = false;

  subscriptions = new Subscription();

  activeMock$!: Observable<IMock>;
  responseType!: string;
  contentType!: string;

  responseCtrl = new UntypedFormControl(null, { updateOn: 'blur' });
  headersCtrl = new UntypedFormControl(null, { updateOn: 'blur' });
  jsCodeCtrl = new UntypedFormControl(null, { updateOn: 'blur' });
  isResponseImage = false;

  /**
   * Read off the request rather than latched while a response loads: the empty
   * state is shown exactly when there is no response, so it has to know whether
   * any exist without one being open.
   */
  get hasMocks(): boolean {
    return Object.keys(this.request?.mocks ?? {}).length > 0;
  }

  readonly tabs = OH_MY_DETAIL_TABS;
  activeTab: OhMyDetailTab = 'Body';

  constructor(
    private storeService: OhMyState,
    private stateService: OhMyStateService,
    public dialog: MatDialog,
    private toast: HotToastService,
    private storageService: StorageService,
    private cdr: ChangeDetectorRef) {
  }

  ngOnInit(): void {
    // Handle mock updates
    this.subscriptions.add(this.stateService.response$.pipe(filter(r => r && r.id === this.response?.id))
      .subscribe(r => {
        this.response = r;
        this.responseCtrl.setValue(r.responseMock, { emitEvent: false });
        this.headersCtrl.setValue(r.headersMock, { emitEvent: false });
        this.jsCodeCtrl.setValue(r.jsCode, { emitEvent: false });
        this.cdr.detectChanges();
      }));

    this.subscriptions.add(this.responseCtrl.valueChanges.subscribe(val => {
      this.storeService.upsertResponse({ responseMock: val, id: this.shownResponse.id }, this.request, this.context);
    }));

    this.subscriptions.add(this.headersCtrl.valueChanges.subscribe(val => {
      this.onHeadersChange(val);
    }));

    this.subscriptions.add(this.jsCodeCtrl.valueChanges.subscribe(val => {
      this.storeService.upsertResponse({ jsCode: val, id: this.shownResponse.id }, this.request, this.context);
    }));
  }

  async ngOnChanges(): Promise<void> {
    // Switching a request off leaves its `selected` entry in place, so "is a
    // response picked" is not the same question as "is one served". The pane
    // must follow the second one, or it offers an editor for a mock that is
    // not being used.
    const mockId = activeMockId(this.request, this.context);

    if (!mockId) {
      this.response = undefined;
      return;
    }

    if (this.response?.id !== mockId) {
      this.response = await this.storageService.get(mockId);

      if (!this.response) {
        return;
      }

      this.responseType = isMimeTypeJSON(this.response?.headersMock?.['content-type']) ? 'json' : (this.response?.headersMock?.['content-type'] ?? '');
      this.isResponseImage = false;

      this.responseCtrl.setValue(this.shownResponse.responseMock, { emitEvent: false });
      this.headersCtrl.setValue(this.shownResponse.headersMock, { emitEvent: false });
      this.jsCodeCtrl.setValue(this.shownResponse.jsCode, { emitEvent: false });
      if (this.shownResponse.headersMock?.['content-type']?.match(/image/)) {
        this.isResponseImage = true;
      }

      // The response is fetched from `chrome.storage`, whose callbacks run
      // outside the Angular zone, so nothing re-renders the pane on its own.
      // Without this the pane keeps showing its "not active" empty state while
      // a response is in fact loaded.
      this.cdr.detectChanges();
    }
  }

  onSelectTab(tab: OhMyDetailTab): void {
    this.activeTab = tab;
  }

  /**
   * The Body tab shows a picture, not an editor, when the mock is an image.
   * `dialogIsOpen` takes precedence: a second Monaco instance on the same
   * content fights the one in the dialog.
   */
  get showImage(): boolean {
    return this.activeTab === 'Body' && this.isResponseImage;
  }

  /** Only the two JSON-shaped tabs can be pretty-printed. */
  get canFormat(): boolean {
    return this.activeTab !== 'Code';
  }

  /**
   * Pretty-prints JSON, and leaves anything else exactly as it was.
   *
   * Two-space indentation rather than the four of `PrettyPrintPipe`: the detail
   * pane is 436px wide in the design, and four spaces per level pushes real
   * payloads off the right edge.
   */
  static formatJson(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }

    const text = String(value);

    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }

  onFormat(): void {
    const control = this.activeTab === 'Headers' ? this.headersCtrl : this.responseCtrl;
    const formatted = RequestComponent.formatJson(control.value);

    if (formatted !== control.value) {
      control.setValue(formatted);
    }
  }

  /** Throws away the mock and puts the recorded value of this tab back. */
  onReset(): void {
    switch (this.activeTab) {
      case 'Headers':
        return this.onRevertHeaders();
      case 'Code':
        return this.onRevertCode();
      default:
        return this.onRevertResponse();
    }
  }

  onRevertResponse(): void {
    this.storeService.upsertResponse({ responseMock: this.shownResponse.response, id: this.shownResponse.id }, this.request, this.context);
  }

  onHeadersChange(headersMock: string): void {
    try {
      this.storeService.upsertResponse({
        id: this.shownResponse.id,
        headersMock: JSON.parse(headersMock)
      }, this.request, this.context);
    } catch {
      // Not JSON yet — the headers editor reports the parse error itself, and
      // half-typed input must not overwrite the stored headers.
    }
  }

  onRevertHeaders(): void {
    this.storeService.upsertResponse({ headersMock: this.shownResponse.headers, id: this.shownResponse.id }, this.request, this.context);
  }

  onRevertCode(): void {
    this.storeService.upsertResponse({ jsCode: '', id: this.shownResponse.id }, this.request, this.context);
  }

  /** Opens the active tab's content in the full-screen editor dialog. */
  onExpand(): void {
    switch (this.activeTab) {
      case 'Headers':
        return this.onShowHeadersFullscreen();
      case 'Code':
        return this.openShowMockCode();
      default:
        return this.onShowResponseFullscreen();
    }
  }

  openShowMockCode(): void {
    const data = { code: this.shownResponse.jsCode, type: 'javascript', allowErrors: false };

    this.openCodeDialog(data, (update: string) => {
      this.storeService.upsertResponse({ jsCode: update, id: this.shownResponse.id }, this.request, this.context);
    });
  }

  onShowResponseFullscreen(): void {
    const data = {
      code: this.shownResponse.responseMock,
      type: extractMimeType(this.shownResponse.headersMock?.['content-type'])
    };

    this.openCodeDialog(data, (update: string) => {
      this.storeService.upsertResponse({
        responseMock: update, id: this.shownResponse.id
      }, this.request, this.context);
    });
  }

  onShowHeadersFullscreen(): void {
    const data = { code: this.shownResponse.headersMock, type: 'json', allowErrors: false };
    this.openCodeDialog(data, (update: string) => {
      this.onHeadersChange(update);
    });
  }

  onAnonymize() {
    if (!isMimeTypeJSON(this.shownResponse.headersMock?.['content-type'])) {
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
        this.storeService.upsertResponse({
          id: this.shownResponse.id,
          ...(update.data && { responseMock: update.data }),
          rules: update.rules }, this.request, this.context);
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
