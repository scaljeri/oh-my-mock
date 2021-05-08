import {
  Component,
  Input,
  OnChanges,
  OnInit
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { IData, statusCode } from '@shared/type';
import { CreateStatusCodeComponent } from 'src/app/components/create-status-code/create-status-code.component';
import { NgApiMockCreateMockDialogWrapperComponent } from 'src/app/plugins/ngapimock/dialog/ng-api-mock-create-mock-dialog-wrapper/ng-api-mock-create-mock-dialog-wrapper.component';
import { findAutoActiveMock } from '../../../utils/data';
import { CreateStatusCode, UpdateDataStatusCode, UpsertData } from 'src/app/store/actions';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { METHODS } from '@shared/constants';

@Component({
  selector: 'app-mock-header',
  templateUrl: './mock-header.component.html',
  styleUrls: ['./mock-header.component.scss']
})
export class MockHeaderComponent implements OnInit, OnChanges {
  @Input() data: IData;
  @Input() domain: string;

  public statusCode: statusCode;
  public codes: statusCode[];
  public methodCtrl = new FormControl();
  public filteredMethodOptions: Observable<string[]>;
  public typeCtrl = new FormControl();
  public filteredTypeOptions: Observable<string[]>;
  public urlCtrl = new FormControl();

  private availableMethods = METHODS;

  @Dispatch() createStatusCode = (statusCode: statusCode, clone: boolean) =>
    new CreateStatusCode({
      url: this.data.url,
      method: this.data.method,
      type: this.data.type,
      clone,
      statusCode,
      activeStatusCode: statusCode
    }, this.domain);

  @Dispatch() updateActiveStatusCode = (statusCode: statusCode) =>
    new UpdateDataStatusCode({
      id: this.data.id,
      statusCode
    }, this.domain);

  @Dispatch() upsertData = (data: IData) => new UpsertData(data);

  constructor(public dialog: MatDialog) { }

  ngOnInit(): void {
    setTimeout(() => {
      if (this.data.activeStatusCode === undefined && Object.keys(this.data.mocks).length > 0) {
        this.onSelectStatusCode(findAutoActiveMock(this.data));
      }
    });

    this.filteredMethodOptions = this.methodCtrl.valueChanges.pipe(
      map(value => this.filter(value, this.availableMethods)),
    );

    this.typeCtrl.valueChanges.subscribe(type => {
      if (type !== this.data.type) {
        this.upsertData({ ...this.data, type });
      }
    });

    this.methodCtrl.setValue(this.data.method);
    this.typeCtrl.setValue(this.data.type);
    this.urlCtrl.setValue(this.data.url);
  }

  private filter(value: string, options: string[]): string[] {
    const filterValue = value.toLowerCase();

    return options.filter(option => option.toLowerCase().indexOf(filterValue) === 0);
  }

  ngOnChanges(): void {
    this.codes = this.data
      ? Object.keys(this.data.mocks).map(Number).sort()
      : [];
  }

  onUrlUpdate(url: string): void {
    this.upsertData({ ...this.data, url });
  }

  onSelectStatusCode(statusCode: statusCode | void): void {
    if (statusCode >= 0) {
      this.updateActiveStatusCode(statusCode as statusCode);
    }
  }

  openAddStatusCodeDialog(): void {
    const dialogRef = this.dialog.open(CreateStatusCodeComponent, {
      width: '280px',
      height: '250px',
      data: { existingStatusCodes: this.codes }
    });

    dialogRef.afterClosed().subscribe((newMock: { statusCode: number, clone: boolean }) => {
      if (newMock) {
        this.statusCode = newMock.statusCode;
        this.createStatusCode(this.statusCode, newMock.clone);
      }
    });
  }

  exportNgApiMock(): void {
    this.dialog.open(NgApiMockCreateMockDialogWrapperComponent, {
      data: this.data
    });
  }

  onMethodBlur(): void {
    const method = (this.methodCtrl.value || '').toUpperCase();

    if (method !== this.data.method) {
      this.upsertData({ ...this.data, method });
    }
  }
}
