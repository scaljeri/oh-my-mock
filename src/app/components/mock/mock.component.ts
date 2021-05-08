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
import { IOhMyContext, IData, IMock, IOhMyMockRule, statusCode } from '@shared/type';
import { CodeEditComponent } from 'src/app/components/code-edit/code-edit.component';
import { FormControl } from '@angular/forms';
import { Subscription } from 'rxjs';
import { IOhMyCodeEditOptions } from '../code-edit/code-edit';
import { AnonymizeComponent } from '../anonymize/anonymize.component';
import { HotToastService } from '@ngneat/hot-toast';

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
  @Dispatch() deleteMockResponse = (response: IOhMyContext) =>
    new DeleteMock(response);

  public delayFormControl = new FormControl();
  public dialogIsOpen = false;
  private delaySubscription: Subscription;
  private activeStatusCode: statusCode;

  @ViewChild('response') responseRef: CodeEditComponent;
  @ViewChild('headers') headersRef: CodeEditComponent;

  constructor(public dialog: MatDialog, private toast: HotToastService, private cdr: ChangeDetectorRef) { }

  ngOnChanges(): void {
    this.mock = this.data.mocks[this.data.activeStatusCode];

    if (this.activeStatusCode !== this.data.activeStatusCode) {
      this.activeStatusCode = this.data.activeStatusCode;

      setTimeout(() => {
        this.responseRef?.update();
        this.headersRef?.update();
      });
    }

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
    if (headersMock) {
      this.upsertMock({ headersMock: JSON.parse(headersMock) });
      this.cdr.detectChanges();
    }
  }

  onRevertHeaders(): void {
    setTimeout(() => {
      this.upsertMock({ headersMock: this.mock.headers });
      this.cdr.detectChanges();
    });
  }

  openShowMockCode(): void {
    const data = { code: this.mock.jsCode, type: 'javascript', allowErrors: false };

    this.openCodeDialog(data, (update: string) => {
      this.upsertMock({ jsCode: update });
    });
  }

  onShowResponseFullscreen(): void {
    const data = { code: this.mock.responseMock, type: this.mock.subType };

    this.openCodeDialog(data, (update: string) => {
      this.upsertMock({ responseMock: update });
      setTimeout(() => {
        this.responseRef.update();
      });
    });
  }

  onShowHeadersFullscreen(): void {
    const data = { code: this.mock.headersMock, type: 'json', allowErrors: false };
    this.openCodeDialog(data, (update: string) => {
      this.upsertMock({ headersMock: JSON.parse(update) });
      setTimeout(() => {
        this.headersRef.update();
      })
    });
  }

  onAnonymize() {
    if (this.mock.subType !== 'json') {
      return this.toast.error('Content-Type should be JSON');
    }

    const dialogRef = this.dialog.open(AnonymizeComponent, {
      width: '80%',
      maxHeight: '90hv',
      panelClass: 'scrollable-dialog',
      data: this.mock
    });

    dialogRef.afterClosed().subscribe((update: { data: string, rules: IOhMyMockRule[] }) => {
      if (update) {
        this.upsertMock({ responseMock: update.data, rules: update.rules });

        setTimeout(() => {
          this.responseRef?.update();
        });
      }
    });
  }

  openCodeDialog(data: IOhMyCodeEditOptions, cb: (update: string) => void): void {
    this.dialogIsOpen = true;
    const dialogRef = this.dialog.open(CodeEditComponent, {
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
