import { Component, Input, OnChanges, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { IData, IMock, IOhMyShallowMock, IState, IStore, ohMyMockId, statusCode } from '@shared/type';
import { CreateStatusCodeComponent } from 'src/app/components/create-status-code/create-status-code.component';
import { NgApiMockCreateMockDialogWrapperComponent } from 'src/app/plugins/ngapimock/dialog/ng-api-mock-create-mock-dialog-wrapper/ng-api-mock-create-mock-dialog-wrapper.component';
// import { findAutoActiveMock } from '../../../utils/data';
import { UpsertData, UpsertMock } from 'src/app/store/actions';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { METHODS, STORAGE_KEY } from '@shared/constants';
import { Store } from '@ngxs/store';
import { OhMyState } from 'src/app/store/state';

@Component({
  selector: 'app-mock-header',
  templateUrl: './mock-header.component.html',
  styleUrls: ['./mock-header.component.scss']
})
export class MockHeaderComponent implements OnInit, OnChanges {
  @Input() data: IData;
  @Input() domain: string;

  public statusCode: statusCode;
  public mockIds: ohMyMockId[];
  public methodCtrl = new FormControl();
  public filteredMethodOptions: Observable<string[]>;
  public typeCtrl = new FormControl();
  public filteredTypeOptions: Observable<string[]>;
  public urlCtrl = new FormControl();

  public oldResponses: string[];

  public availableMethods = METHODS;

  @Dispatch() upsertMock = (mock: Partial<IMock>, clone: boolean) =>
    new UpsertMock({ id: this.data.id, clone, makeActive: true, mock }, this.domain)
  @Dispatch() upsertData = (data: IData) => new UpsertData({ ...data, id: this.data.id }, this.domain);

  constructor(public dialog: MatDialog, private store: Store) { }

  ngOnInit(): void {
    setTimeout(() => {
      if (!this.data.activeMock && Object.keys(this.data.mocks).length > 0) {
        // this.onSelectStatusCode(findAutoActiveMock(this.data));
      }
    });

    this.methodCtrl.valueChanges.subscribe(val => {
      const method = (val || '').toUpperCase();
      this.upsertData({ ...this.data, method });
    });

    this.typeCtrl.valueChanges.subscribe(type => {
      if (type !== this.data.type) {

        this.upsertData({ ...this.data, type });
      }
    });

    this.methodCtrl.setValue(this.data.method);
    this.typeCtrl.setValue(this.data.type);
    this.urlCtrl.setValue(this.data.url);
  }

  ngOnChanges(): void {
    this.mockIds = this.data
      ? Object.keys(this.data.mocks).sort((a, b) => {
        const ma = this.data.mocks[a];
        const mb = this.data.mocks[b];

        return ma.statusCode === mb.statusCode ? 0 : ma.statusCode > mb.statusCode ? 1 : -1;
      }) : [];
  }

  onUrlUpdate(url: string): void {
    this.upsertData({ ...this.data, url });
  }

  onSelectStatusCode(mockId: ohMyMockId | void): void {
    if (mockId) {
      // this.upsertData({ activeMock: mockId, enabled: true })
    } else {
      // this.upsertData({ enabled: false })
    }
  }

  openAddResponseDialog(): void {
    const dialogRef = this.dialog.open(CreateStatusCodeComponent, {
      width: '280px',
      height: '380px',
      data: { existingStatusCodes: this.mockIds }
    });

    dialogRef.afterClosed().subscribe((newMock: { statusCode: statusCode, clone: boolean, name: string }) => {
      if (newMock) {
        const clone = newMock.clone;
        delete newMock.clone;
        this.oldResponses = Object.keys(this.data.mocks);

        this.upsertMock(newMock, clone);
      }
    });
  }

  exportNgApiMock(): void {
    this.dialog.open(NgApiMockCreateMockDialogWrapperComponent, {
      data: this.data
    });
  }

  onMethodBlur(): void {
    console.log('received: ' + this.methodCtrl.value);
    const method = (this.methodCtrl.value || '').toUpperCase();

    console.log('onMethodBlur');
    // if (method !== this.data.method) {
    //   this.upsertData({ ...this.data, method });
    // }
  }

  getMock(id: ohMyMockId): IOhMyShallowMock {
   
    return this.data.mocks[id];
  }

  onMethodChange(event): void {
    console.log('onMethodChage', event);
  }

  get stateSnapshot(): IState {
    return this.store.selectSnapshot<IState>((state: IStore) => {
      return state[STORAGE_KEY].content.states[OhMyState.domain];
    });
  }
}
