import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Select, Store } from '@ngxs/store';
import * as hljs from 'highlight.js';
import { HotToastService } from '@ngneat/hot-toast';
import { IResponseMock, IResponses, IState, IDeleteResponse, IUpsertResponse, statusCode } from 'src/shared/type';
import { STATUS_CODE_EXISTS, STORAGE_KEY } from 'src/shared/constants';
import { AppStateService } from '../../services/app-state.service';
import { OhMyState } from 'src/app/store/state';
import { Observable } from 'rxjs';
import { CodeEditComponent } from '../code-edit/code-edit.component';
import { DeleteResponse, UpsertResponses } from 'src/app/store/actions';

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
  responses: IResponses;
  url: string;

  state: IResponses;
  mocks: Record<statusCode, IResponseMock> = {};
  // mockResponse: string;
  activeStatusCode: statusCode;
  jsCode: string;
  enabled = false;
  statusCodeError: string;

  @ViewChild('responseMock') responseMock: ElementRef;
  @ViewChild('responseOrig') responseOrig: ElementRef;
  // @ViewChild('codeEditor') editor: ElementRef;

  @Dispatch() upsertResponses = (responses: IResponses) => new UpsertResponses(responses);
  @Dispatch() deleteMockResponse = (response: IDeleteResponse) => new DeleteResponse(response);
  @Select(OhMyState.getState) state$: Observable<{ OhMyState: IState }>;

  constructor(
    private appState: AppStateService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private activeRoute: ActivatedRoute,
    private store: Store,
    public dialog: MatDialog,
    private toast: HotToastService,
    private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
    const { index } = this.activeRoute.snapshot.params;
    const { statusCode } = this.activeRoute.snapshot.queryParams;

    this.store.selectSnapshot<IResponses>((s: { [STORAGE_KEY]: IState }) => {
      this.state = s[STORAGE_KEY].responses[index];
      this.enabled = this.state.enabled;

      if (!this.state) {
        this.router.navigate(['/']);
      } else {
        this.codes = Object.keys(this.state.mocks).sort();
        this.onViewMock(statusCode || this.codes[0]);
      }

      return this.state;
    });
  }

  ngAfterViewInit(): void {
    // this.state$.subscribe(state => {
    //   debugger;
    // });
    // const { index } = this.activeRoute.snapshot.params;
    // const { statusCode } = this.activeRoute.snapshot.queryParams;

    setTimeout(() => {
      // this.state = this.store.selectSnapshot<IResponses>((state: { [STORAGE_KEY]: IState }) => {
      //   return state[STORAGE_KEY].responses[index];
      // });

      // if (!this.state) {
      //   return this.router.navigate(['/']);
      // }

      // this.codes = Object.keys(this.state.mocks).sort();
      // this.onViewMock(statusCode || this.codes[0]);

      setTimeout(() => {
        hljs.highlightBlock(this.responseOrig.nativeElement);
        hljs.highlightBlock(this.responseMock.nativeElement);
      }, 100);
    });


    // this.responses = this.appState.responses;

    // this.codes = Object.values(this.responses.mocks).sort();
    // this.originalResponse = JSON.stringify(this.mock.payload, null, 4);
    // this.store.select(state => state[STORAGE_KEY].urls[mockId])
    //   .subscribe((mock: IMock) => {
    //     this.mock = { ...this.mock, payload: mock.payload };
    //   });
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

    this.activeStatusCode = code;
    this.mocks[code] = { ...(this.state.mocks[code] || {}) };

    this.router.navigate(
      [],
      {
        relativeTo: this.activatedRoute,
        queryParams: { statusCode: code },
        queryParamsHandling: 'merge',
      });
  }

  onViewMockAdd(): void {
    this.onViewMock(0);

    if (this.codes.indexOf(0) === -1) {
      this.codes.push(0);
    }
  }

  onMockChange(json: string): void {
    this.activeMock.mock = json;
  }

  onSave(): void {
    this.upsertResponses({
      url: this.state.url,
      method: this.state.method,
      type: this.state.type,
      activeStatusCode: this.activeStatusCode,
      enabled: this.enabled,
      mocks: {
        ...this.state.mocks,
        ...this.mocks
      }
    });
  }

  validateStatusCode(value: string): void {
    this.statusCodeError = null

    if (this.codes.indexOf(value) !== -1) {
      this.statusCodeError = STATUS_CODE_EXISTS;
    }
  }

  onDelete(): void {
    const { url, method, type } = this.state;
    this.deleteMockResponse({url, method, type, statusCode: this.activeStatusCode });
  }

  openDialog(): void {
    const dialogRef = this.dialog.open(CodeEditComponent, {
      width: '80%',
      data: { code: this.jsCode, originalCode: this.activeMock.jsCode }
    });

    dialogRef.afterClosed().subscribe(result => {
      this.jsCode = result;
    });
  }

  get activeMock(): IResponseMock {
    return this.mocks[this.activeStatusCode];
  }
}
