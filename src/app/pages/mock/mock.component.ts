import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Select, Store } from '@ngxs/store';
import { OhMyState } from 'src/app/store/state';
import { Observable, Subscription } from 'rxjs';
import { DeleteMock, UpsertData, UpsertMock } from 'src/app/store/actions';
import { IData, IDeleteMock, IMock, IOhMyMock, IState, IStore, statusCode } from '@shared/type';
import { CodeEditComponent } from 'src/app/components/code-edit/code-edit.component';

@Component({
  selector: 'app-mock',
  templateUrl: './mock.component.html',
  styleUrls: ['./mock.component.scss']
})
export class MockComponent implements OnInit {
  data: IData;
  mock: IMock;
  mocks: Record<statusCode, IMock> = {};
  statusCode: statusCode;
  responseMock: string;
  headersMock: Record<string, string>;

  @ViewChild('responseRef') responseRef: ElementRef;

  @Dispatch() upsertData = (data: IData) => new UpsertData(data);
  @Dispatch() upsertMock = (mock: IMock) => new UpsertMock({
    url: this.data.url, method: this.data.method, type: this.data.type, statusCode: this.data.activeStatusCode, mock
  });
  @Dispatch() deleteMockResponse = (response: IDeleteMock) => new DeleteMock(response);
  @Select(OhMyState.getActiveState) state$: Observable<IState>;

  constructor(
    private router: Router,
    private activeRoute: ActivatedRoute,
    public dialog: MatDialog,
    private store: Store,
    private cdr: ChangeDetectorRef) { }

  ngOnInit() {
    const index = Number(this.activeRoute.snapshot.params.index);

    this.state$.subscribe(state => {
      this.data = state?.data[index];

      if (!this.data) {
        return this.router.navigate(['/']);
      }

      this.mock = this.data.mocks[this.data.activeStatusCode] || {};

      if (!this.responseMock) {
        this.responseMock = this.mock?.responseMock;
        this.headersMock = this.mock.headersMock;
      }
    });
  }

  onDelete(): void {
    const { url, method, type, activeStatusCode } = this.data;
    this.deleteMockResponse({ url, method, type, statusCode: activeStatusCode });
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

  onResponseChange(data): void {
    this.responseMock = data;
    this.upsertMock({ responseMock: data });
  }

  onRevertResponse(): void {
    setTimeout(() => { // Make sure that `onResponseChanges` goes first!
      this.responseMock = this.mock.response;
      this.upsertMock({ responseMock: this.mock.response });
      this.cdr.detectChanges();
    });
  }
}
