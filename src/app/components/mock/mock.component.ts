import {
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  ViewChild,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { DeleteMock, UpsertMock } from 'src/app/store/actions';
import { IData, IDeleteMock, IMock } from '@shared/type';
import { CodeEditComponent } from 'src/app/components/code-edit/code-edit.component';
import { FormControl } from '@angular/forms';
import { Subscription } from 'rxjs';

@Component({
  selector: 'oh-my-mock',
  templateUrl: './mock.component.html',
  styleUrls: ['./mock.component.scss']
})
export class MockComponent implements OnChanges {
  @Input() data: IData;
  @Input() domain: string;
  mock: IMock;

  @Dispatch() upsertMock = (mock: IMock) =>
    new UpsertMock({
      url: this.data.url,
      method: this.data.method,
      type: this.data.type,
      statusCode: this.data.activeStatusCode,
      mock
    }, this.domain);
  @Dispatch() deleteMockResponse = (response: IDeleteMock) =>
    new DeleteMock(response);

  public delayFormControl = new FormControl();
  private delaySubscription: Subscription;

  @ViewChild('response') responseRef: CodeEditComponent;
  @ViewChild('headers') headersRef: CodeEditComponent;

  constructor(public dialog: MatDialog, private cdr: ChangeDetectorRef) { }

  ngOnChanges(): void {
    this.mock = this.data.mocks[this.data.activeStatusCode];

    if (this.delaySubscription) {
      this.delaySubscription.unsubscribe();
    }
    this.delayFormControl.setValue(this.mock?.delay);

    // NOTE: The subscription var is needed because ngOnChanges will trigger each time this.mock changes
    let delayTimeoutId;
    this.delaySubscription = this.delayFormControl.valueChanges.subscribe(value => {
      clearTimeout(delayTimeoutId);
      if (value !== '') {
        delayTimeoutId = setTimeout(() => {
          this.upsertMock({ delay: Number(value) });
        }, 500);
      }
    });
  }

  onDelete(): void {
    const { url, method, type, activeStatusCode } = this.data;
    this.deleteMockResponse({
      url,
      method,
      type,
      statusCode: activeStatusCode
    });
  }

  onResponseChange(data: string): void {
    this.upsertMock({ responseMock: data });
  }

  onRevertResponse(): void {
    setTimeout(() => {
      // Make sure that `onResponseChanges` goes first!
      this.upsertMock({ responseMock: this.mock.response });
      this.cdr.detectChanges();
    });
  }

  onHeadersChange(headersMock: string): void {
    this.upsertMock({ headersMock: JSON.parse(headersMock) });
    this.cdr.detectChanges();
  }

  onRevertHeaders(): void {
    setTimeout(() => {
      this.upsertMock({ headersMock: this.mock.headers });
      this.cdr.detectChanges();
    });
  }

  openShowMockCode(): void {
    this.openCodeDialog(this.mock.jsCode, 'javascript', (update: string) => {
      this.upsertMock({ jsCode: update });
    });
  }

  onShowResponseFullscreen(): void {
    this.openCodeDialog(this.mock.responseMock, this.mock.subType, (update: string) => {
      this.upsertMock({ responseMock: update });
      setTimeout(() => {
        this.responseRef.update();
      });
    });
  }

  onShowHeadersFullscreen(): void {
    this.openCodeDialog(this.mock.headersMock, 'json', (update: string) => {
      this.upsertMock({ headersMock: JSON.parse(update) });
      setTimeout(() => {
        this.headersRef.update();
      })
    });
  }

  openCodeDialog(code: string | Record<string, string>, type: string, cb: (update: string) => void): void {
    const dialogRef = this.dialog.open(CodeEditComponent, {
      width: '80%',
      data: { code, type }
    });

    dialogRef.afterClosed().subscribe(update => {
      if (update) {
        cb(update);
      }
    });
  }
}
