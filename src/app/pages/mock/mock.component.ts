import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Select } from '@ngxs/store';
import * as hljs from 'highlight.js';
import { STORAGE_KEY } from 'src/shared/constants';
import { OhMyState } from 'src/app/store/state';
import { Observable, Subscription } from 'rxjs';
import { DeleteMock, UpsertData, UpsertMock } from 'src/app/store/actions';
import { IData, IDeleteMock, IMock, IState, IStore, statusCode } from '@shared/type';
import { PrettyPrintPipe } from 'src/app/pipes/pretty-print.pipe';
import { CodeEditComponent } from 'src/app/components/code-edit/code-edit.component';

@Component({
  selector: 'app-mock',
  templateUrl: './mock.component.html',
  styleUrls: ['./mock.component.scss']
})
export class MockComponent implements OnInit, AfterViewInit, OnDestroy {
  codes = [];
  data: IData;
  mocks: Record<statusCode, IMock> = {};
  statusCode: statusCode;
  enabled = false;
  statusCodeError: string;
  index: number;
  mock: IMock;
  saveTimeoutId: number;
  mockJsonError: string = null;

  @ViewChild('mockRef') mockRef: ElementRef;
  @ViewChild('responseRef') responseRef: ElementRef;

  @Dispatch() upsertData = (data: IData) => new UpsertData(data);
  @Dispatch() upsertMock = (mock: IMock) => new UpsertMock({
    url: this.data.url, method: this.data.method, type: this.data.type, statusCode: this.data.activeStatusCode, mock
  });
  @Dispatch() deleteMockResponse = (response: IDeleteMock) => new DeleteMock(response);
  @Select(OhMyState.getActiveState) state$: Observable<IState>;

  private subscription: Subscription;

  constructor(
    private router: Router,
    private activeRoute: ActivatedRoute,
    public dialog: MatDialog,
    private prettyPrintPipe: PrettyPrintPipe,
    private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
    this.subscription = this.state$.subscribe((state: IState) => {
      this.init(state);
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  init(state: IState): void {
    const index = Number(this.activeRoute.snapshot.params.index);
    this.data = state?.data[index];

    if (!this.data) {
      this.router.navigate(['/']);
    } else {
      this.enabled = this.data.enabled;
      this.codes = Object.keys(this.data.mocks).sort();
      this.initMock();
    }
    this.cdr.detectChanges();
  }

  ngAfterViewInit(): void {
  }

  initMock() {
    this.mock = this.data.mocks[this.data.activeStatusCode] || {};

    if (this.data.activeStatusCode > 0) {
      setTimeout(() => {
        this.injectJSON(this.responseRef, this.mock.response);
        this.injectJSON(this.mockRef, this.mock.mock, true);
      });
    }
  }

  onDelete(): void {
    const { url, method, type, activeStatusCode } = this.data;
    this.deleteMockResponse({ url, method, type, statusCode: activeStatusCode });
  }

  onMockChange(event): void {
    const mockValue = this.mockRef.nativeElement.innerText;
    this.mockJsonError = null;

    if (mockValue) {
      try {
        const json = JSON.parse(mockValue);
        this.upsertMock({mock: mockValue})
      } catch (err) {
        this.mockJsonError = err;
      }
    }
    console.log(mockValue);
  }

  openJsCodeDialog(): void {
    const dialogRef = this.dialog.open(CodeEditComponent, {
      width: '80%',
      data: { code: this.mock.jsCode, originalCode: this.mock.jsCode }
    });

    dialogRef.afterClosed().subscribe(jsCode => {
      this.upsertMock({ jsCode });
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

  onEnableMockToggle(checked): void {
    this.upsertMock({ useMock: checked })
  }
}
