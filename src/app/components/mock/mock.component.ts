import {
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { DeleteMock, UpsertMock } from 'src/app/store/actions';
import { IData, IDeleteMock, IMock } from '@shared/type';
import { CodeEditComponent } from 'src/app/components/code-edit/code-edit.component';

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

  constructor(public dialog: MatDialog, private cdr: ChangeDetectorRef) { }

  ngOnChanges(): void {
    this.mock = this.data.mocks[this.data.activeStatusCode];
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

  openJsCodeDialog(): void {
    const dialogRef = this.dialog.open(CodeEditComponent, {
      width: '80%',
      data: { code: this.mock.jsCode, originalCode: this.mock.jsCode }
    });

    dialogRef.afterClosed().subscribe((jsCode) => {
      this.upsertMock({ jsCode });
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
}
