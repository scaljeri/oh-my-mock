import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Select, Store } from '@ngxs/store';
import * as hljs from 'highlight.js';
import { HotToastService } from '@ngneat/hot-toast';
import { STORAGE_KEY } from 'src/shared/constants';
import { AppStateService } from '../../services/app-state.service';
import { OhMyState } from 'src/app/store/state';
import { Observable } from 'rxjs';
import { CodeEditComponent } from '../code-edit/code-edit.component';
import { CreateStatusCode, DeleteMock, UpsertData, UpsertMock } from 'src/app/store/actions';
import { IData, IDeleteMock, IMock, IState, IStore, statusCode } from '@shared/type';
import { CreateStatusCodeComponent } from '../create-status-code/create-status-code.component';
import { PrettyPrintPipe } from 'src/app/pipes/pretty-print.pipe';

const DEFAULT_CODE = `// global variables:
//   response: if active, this variable contains the api response
//   mock: if active, this variable contains the mock data
// IMPORTANT: This code should return a response!'

return mock || response;`;

@Component({
  selector: 'app-mock',
  templateUrl: './mock.component.html',
  styleUrls: ['./mock.component.scss']
})
export class MockComponent implements OnInit, AfterViewInit {
  defaultCode = DEFAULT_CODE;
  panelOpenState = false;
  originalResponse: string;
  jsonError: string;
  jsError: string;
  isSyntaxOk = false;
  text: string;
  codes = [];
  responses: IData;
  url: string;

  state: IData;
  mocks: Record<statusCode, IMock> = {};
  // mockResponse: string;
  statusCode: statusCode;
  jsCode: string;
  enabled = false;
  statusCodeError: string;
  index: number;
  mock: IMock;
  saveTimeoutId: number;

  @ViewChild('mockRef') mockRef: ElementRef;
  @ViewChild('responseRef') responseRef: ElementRef;
  // @ViewChild('codeEditor') editor: ElementRef;

  @Dispatch() createStatusCode = (statusCode: statusCode) =>
    new CreateStatusCode({ url: this.state.url, method: this.state.method, type: this.state.type, statusCode });
  @Dispatch() upsertData = (data: IData) => new UpsertData(data);
  @Dispatch() upsertMock = (mock: IMock) => new UpsertMock(mock);
  @Dispatch() deleteMockResponse = (response: IDeleteMock) => new DeleteMock(response);
  @Select(OhMyState.getState) state$: Observable<IStore>;

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private activeRoute: ActivatedRoute,
    public dialog: MatDialog,
    private prettyPrintPipe: PrettyPrintPipe,
    private toast: HotToastService,
    private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
    this.state$.subscribe((state: IStore) => {
      this.init(state);
    });
  }

  init(state: IStore): void {
    const index = Number(this.activeRoute.snapshot.params.index);
    this.state = state[STORAGE_KEY].data[index];

    if (!this.state) {
      this.router.navigate(['/']);
    } else {
      this.statusCode = this.statusCode || Number(this.activeRoute.snapshot.queryParams || this.state.activeStatusCode);
      this.enabled = this.state.enabled;
      this.codes = Object.keys(this.state.mocks).sort();
      this.onViewMock(this.statusCode || this.codes[0]);
    }
    this.cdr.detectChanges();
  }

  ngAfterViewInit(): void {
  }

  onActivityMocksChange(): void {
    // TODO
  }

  onUrlUpdate(event): void {
    // TODO
  }

  onViewMock(code: statusCode) {
    if (code === undefined) {
      return;
    }

    this.statusCode = Number(code);
    this.mock = { ... this.state.mocks[this.statusCode] };

    this.router.navigate(
      [],
      {
        relativeTo: this.activatedRoute,
        queryParams: { statusCode: code },
        queryParamsHandling: 'merge',
      });

    setTimeout(() => {
      this.injectJSON(this.responseRef, this.mock.response);
      this.injectJSON(this.mockRef, this.mock.mock, true);
    })
  }

  onViewMockAdd(): void {
    this.onViewMock(0);

    if (this.codes.indexOf(0) === -1) {
      this.codes.push(0);
    }
  }

  onMockChange(event: KeyboardEvent): void {
    // TODO: validate if dataType is json

    clearTimeout(this.saveTimeoutId);
    this.mock.mock = (event.target as HTMLElement).innerText;
    this.saveTimeoutId = setTimeout(() => {
      this.save();
    }, 1000);
  }

  save(): void {
    const mocks = { ... this.state.mocks };
    mocks[this.statusCode] = this.mock;

    this.upsertData({
      url: this.state.url,
      method: this.state.method,
      type: this.state.type,
      activeStatusCode: this.statusCode,
      enabled: this.enabled,
      mocks
    });

    this.toast.success('Changes saved');
  }

  onDelete(): void {
    const { url, method, type } = this.state;
    this.deleteMockResponse({ url, method, type, statusCode: this.statusCode });
  }

  openJsCodeDialog(): void {
    const dialogRef = this.dialog.open(CodeEditComponent, {
      width: '80%',
      data: { code: this.jsCode, originalCode: this.mock.jsCode }
    });

    dialogRef.afterClosed().subscribe(result => {
      this.jsCode = result;
    });
  }

  openAddStatusCodeDialog(): void {
    const dialogRef = this.dialog.open(CreateStatusCodeComponent, {
      width: '250px',
      height: '250px',
      data: { existingStatusCodes: this.codes }
    });

    dialogRef.afterClosed().subscribe(newStatusCode => {
      this.statusCode = newStatusCode;
      this.createStatusCode(newStatusCode);
    });
  }

  injectJSON(ref: ElementRef, json: Record<string, unknown>, editable = false) {
    ref.nativeElement.innerHTML = '';

    const codeEl = document.createElement('code');
    codeEl.className = 'language-json';
    if (editable) {
      codeEl.setAttribute('contenteditable', "true");
    }
    codeEl.innerText = this.prettyPrintPipe.transform(json);
    hljs.highlightBlock(codeEl);
    ref.nativeElement.appendChild(codeEl);
  }
}
