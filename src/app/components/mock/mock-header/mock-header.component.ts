import {
  Component,
  Input,
  OnChanges,
  OnInit
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { IData, ohMyMockId, statusCode } from '@shared/type';
import { CreateStatusCodeComponent } from 'src/app/components/create-status-code/create-status-code.component';
import { NgApiMockCreateMockDialogWrapperComponent } from 'src/app/plugins/ngapimock/dialog/ng-api-mock-create-mock-dialog-wrapper/ng-api-mock-create-mock-dialog-wrapper.component';
import { findAutoActiveMock } from '../../../utils/data';
import { CreateResponse, UpdateDataResponse, UpsertData } from 'src/app/store/actions';
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
  public codes: ohMyMockId[];
  public methodCtrl = new FormControl();
  public filteredMethodOptions: Observable<string[]>;
  public typeCtrl = new FormControl();
  public filteredTypeOptions: Observable<string[]>;
  public urlCtrl = new FormControl();

  private availableMethods = METHODS;

  @Dispatch() createResponse = (newResponse: { statusCode: statusCode, clone: boolean, name: string }) =>
    new CreateResponse({
      id: this.data.id,
      ...newResponse
    }, this.domain);

  @Dispatch() updateActiveResponse = (mockId: ohMyMockId | void) =>
    new UpdateDataResponse({
      id: this.data.id,
      mockId
    }, this.domain);

  @Dispatch() upsertData = (data: IData) => new UpsertData(data);

  constructor(public dialog: MatDialog) { }

  ngOnInit(): void {
    setTimeout(() => {
      if (!this.data.activeStatusCode && Object.keys(this.data.mocks).length > 0) {
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
    // TODO
    this.codes = this.data
      ? Object.keys(this.data.mocks).sort()
      : [];
  }

  onUrlUpdate(url: string): void {
    this.upsertData({ ...this.data, url });
  }

  onSelectStatusCode(mockId: ohMyMockId | void): void {
    debugger;
    this.updateActiveResponse(mockId);
  }

  openAddResponseDialog(): void {
    const dialogRef = this.dialog.open(CreateStatusCodeComponent, {
      width: '280px',
      height: '280px',
      data: { existingStatusCodes: this.codes }
    });

    dialogRef.afterClosed().subscribe((newMock: { statusCode: statusCode, clone: boolean, name: string }) => {
      if (newMock) {
        this.statusCode = newMock.statusCode;
        this.createResponse(newMock);
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
