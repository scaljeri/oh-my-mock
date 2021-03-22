import { Component, EventEmitter, HostBinding, Input, Output } from '@angular/core';
import { HotToastService } from '@ngneat/hot-toast';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Store } from '@ngxs/store';
import { DeleteData, UpdateDataStatusCode, UpsertData } from 'src/app/store/actions';
import { OhMyState } from 'src/app/store/state';
import { findAutoActiveMock } from 'src/app/utils/data';
import { IData, IState, IStore, statusCode } from 'src/shared/type';

@Component({
  selector: 'oh-my-data-list',
  templateUrl: './data-list.component.html',
  styleUrls: ['./data-list.component.scss']
})
export class DataListComponent {
  @Input() data: IData[] = [];
  @Input() domain: string;
  @Input() showDelete: boolean;
  @Input() showClone: boolean;
  @Input() showActivate: boolean;
  @Input() @HostBinding('class') theme = 'dark';
  @Output() select = new EventEmitter<number>();

  @Dispatch() deleteData = (dataIndex: number) => new DeleteData(dataIndex);
  @Dispatch() upsertData = (data: IData) => new UpsertData(data);
  @Dispatch() updateActiveStatusCode = (data: IData, statusCode: statusCode) =>
    new UpdateDataStatusCode({ url: data.url, method: data.method, type: data.type, statusCode });

  public displayedColumns = ['type', 'method', 'url', 'activeStatusCode', 'actions'];

  constructor(private store: Store, private toast: HotToastService) {}

  ngOnChanges(): void {
    if (this.displayedColumns.indexOf('rowAction') === 0) {
      this.displayedColumns.shift();
    }
  }

  onActivateToggle(rowIndex: number): void {
    const data = this.data[rowIndex];

    if (data.activeStatusCode === 0) {
      const statusCode = findAutoActiveMock(data);
      this.updateActiveStatusCode(this.data[rowIndex], statusCode as number);
      this.toast.success(`Mock with status-code ${statusCode} activated`);
    } else {
      this.updateActiveStatusCode(this.data[rowIndex], 0);
      this.toast.warning('Mock disabled!');
    }
  }

  onDelete(rowIndex: number): void {
    this.deleteData(rowIndex);
  }

  onClone(rowIndex: number): void {
    const data = this.data[rowIndex];
    const state = this.getActiveStateSnapshot();

    if (!state.data.some(d => d.url === data.url)) {
      this.upsertData(data);
      this.toast.success('Cloned ' + data.url);
    } else {
      this.toast.error(`Mock already exists (${data.url})`);
    }
  }

  onDataClick(event: MouseEvent, index: number): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.mat-column-actions')) {
      this.select.emit(index);
    }
  }

  private getActiveStateSnapshot(): IState {
    return this.store.selectSnapshot<IState>((state: IStore) => OhMyState.getActiveState(state));
  }
}

