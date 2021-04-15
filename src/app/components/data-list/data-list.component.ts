import { SelectionModel } from '@angular/cdk/collections';
import { Component, ElementRef, EventEmitter, HostBinding, Input, OnChanges, OnDestroy, OnInit, Output, QueryList, ViewChildren } from '@angular/core';
import { HotToastService } from '@ngneat/hot-toast';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Store } from '@ngxs/store';
import { DeleteData, UpdateDataStatusCode, UpsertData } from 'src/app/store/actions';
import { AnimationBuilder } from "@angular/animations";
import { findActiveData } from '../../../shared/utils/find-mock'

import { OhMyState } from 'src/app/store/state';
import { findAutoActiveMock } from 'src/app/utils/data';
import { IContext, IData, IState, IStore, statusCode } from 'src/shared/type';
import { AppStateService } from 'src/app/services/app-state.service';
import { Subscription } from 'rxjs';
import { animate, style } from '@angular/animations';

export const highlightSeq = [
  style({ backgroundColor: '*' }),
  animate('1s ease-in', style({ backgroundColor: '{{color}}' })),
  animate('1s ease-out', style({ backgroundColor: '*' }))
];

@Component({
  selector: 'oh-my-data-list',
  templateUrl: './data-list.component.html',
  styleUrls: ['./data-list.component.scss'],
})
export class DataListComponent implements OnInit, OnChanges, OnDestroy {
  @Input() data: IData[] = [];
  @Input() domain: string;
  @Input() showDelete: boolean;
  @Input() showClone: boolean;
  @Input() showActivate: boolean;
  @Input() showExport: boolean;
  @Input() @HostBinding('class') theme = 'dark';
  @Output() select = new EventEmitter<number>();
  @Output() dataExport = new EventEmitter<number>();

  @Dispatch() deleteData = (dataIndex: number) => new DeleteData(dataIndex, this.domain);
  @Dispatch() upsertData = (data: IData) => new UpsertData(data);
  @Dispatch() updateActiveStatusCode = (data: IData, statusCode: statusCode) =>
    new UpdateDataStatusCode({ url: data.url, method: data.method, type: data.type, statusCode }, this.domain);

  public displayedColumns = ['type', 'method', 'url', 'activeStatusCode', 'actions'];
  public selection = new SelectionModel<number>(true);
  private hitSubscription: Subscription;
  public hits: boolean[] = [];

  @ViewChildren('row', { read: ElementRef }) rows: QueryList<ElementRef>;

  constructor(
    private appState: AppStateService,
    private animationBuilder: AnimationBuilder,
    private store: Store,
    private toast: HotToastService) { }

  ngOnInit(): void {
    this.hitSubscription = this.appState.hit$.subscribe((context: IContext) => {
      const data = findActiveData(this.getActiveStateSnapshot(),
        context.url, context.method, context.type);

      if (data) {
        const index = this.data.indexOf(data);

        const highlightFactory = this.animationBuilder.build(highlightSeq);
        const highlightPlayer = highlightFactory.create(this.rows.toArray()[index].nativeElement, { params: { color: '#97A8B6' } });
        highlightPlayer.play();
      }
    });
  }
  ngOnChanges(): void {
    if (this.displayedColumns.indexOf('rowAction') === 0) {
      this.displayedColumns.shift();
    }
  }

  ngOnDestroy(): void {
    this.hitSubscription.unsubscribe();
  }

  onActivateToggle(rowIndex: number): void {
    const data = this.data[rowIndex];

    if (!data.activeStatusCode) {
      const statusCode = findAutoActiveMock(data);
      this.updateActiveStatusCode(this.data[rowIndex], statusCode as number);
      this.toast.success(`Mock with status-code ${statusCode} activated`);
    } else {
      this.updateActiveStatusCode(this.data[rowIndex], 0);
      this.toast.warning('Mock disabled!');
    }
  }

  onDelete(rowIndex: number): void {
    let msg = `Deleted mock ${this.data[rowIndex].url}`;
    if (this.domain) {
      msg += ` on domain ${this.domain}`;
    }
    this.toast.success(msg, { duration: 2000, style: {}});
    this.deleteData(rowIndex);
  }

  onClone(rowIndex: number): void {
    const data = this.data[rowIndex];
    const state = this.getActiveStateSnapshot();

    // Cannot clone a mock which already exists
    if (!findActiveData(state, data.url, data.method, data.type)) {
      this.upsertData(data);
      this.toast.success('Cloned ' + data.url);
    } else {
      this.toast.error(`Mock already exists (${data.url})`);
    }
  }

  onDataClick(event: MouseEvent, index: number): void {
    const target = event.target as HTMLElement;
    this.selection.toggle(index);
    if (!target.closest('.mat-column-actions')) {
      this.select.emit(index);
    }
  }

  onExport(rowIndex: number) {
    this.dataExport.emit(rowIndex);
  }

  public selectAll(): void {
    this.data.forEach((d, i) => {
      this.selection.select(i);
    });
  }

  public deselectAll(): void {
    this.selection.clear();
  }

  private getActiveStateSnapshot(): IState {
    return this.store.selectSnapshot<IState>((state: IStore) => OhMyState.getActiveState(state));
  }
}

