import { SelectionModel } from '@angular/cdk/collections';
import { Component, ElementRef, EventEmitter, HostBinding, Input, OnChanges, OnDestroy, OnInit, Output, QueryList, ViewChildren } from '@angular/core';
import { HotToastService } from '@ngneat/hot-toast';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Store } from '@ngxs/store';
import { trigger, style, animate, transition } from "@angular/animations";
import { DeleteData, Toggle, UpdateDataStatusCode, UpsertData, ViewChangeOrderItems, ViewReset } from 'src/app/store/actions';
import { findActiveData } from '../../../shared/utils/find-mock'

import { OhMyState } from 'src/app/store/state';
import { findAutoActiveMock } from 'src/app/utils/data';
import { IData, IState, IStore, statusCode } from 'src/shared/type';
import { AppStateService } from 'src/app/services/app-state.service';
import { Subscription } from 'rxjs';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { arrayMoveItem } from '@shared/utils/array';
import { UntilDestroy } from '@ngneat/until-destroy';
import { isViewValidate } from '../../utils/validate-view';

export const highlightSeq = [
  style({ backgroundColor: '*' }),
  animate('1s ease-in', style({ backgroundColor: '{{color}}' })),
  animate('1s ease-out', style({ backgroundColor: '*' }))
];

@UntilDestroy({ arrayName: 'subscriptions' })
@Component({
  selector: 'oh-my-data-list',
  templateUrl: './data-list.component.html',
  styleUrls: ['./data-list.component.scss'],
  animations: [
    trigger("inOutAnimation", [
      transition(":leave", [
        style({ height: "*", opacity: 1, paddingTop: "*", paddingBottom: "*" }),
        animate(
          ".7s ease-in",
          style({ height: 0, opacity: 0, paddingTop: 0, paddingBottom: 0 })
        )
      ])
    ])
  ]
})
export class DataListComponent implements OnInit, OnChanges, OnDestroy {
  @Input() state: IState;
  @Input() showDelete: boolean;
  @Input() showClone: boolean;
  @Input() showActivate: boolean;
  @Input() showExport: boolean;
  @Input() @HostBinding('class') theme = 'dark';
  @Output() select = new EventEmitter<number>();
  @Output() dataExport = new EventEmitter<number>();

  @Dispatch() deleteData = (dataIndex: number) => new DeleteData(dataIndex, this.state.domain);
  @Dispatch() upsertData = (data: IData) => new UpsertData(data);
  @Dispatch() viewReorder = (name: string, from: number, to: number) => new ViewChangeOrderItems({ name, from, to });
  @Dispatch() viewReset = (name: string) => new ViewReset(name);
  @Dispatch() toggleHitList = (value: boolean) => new Toggle({ name: 'hits', value });
  @Dispatch() updateActiveStatusCode = (data: IData, statusCode: statusCode) =>
    new UpdateDataStatusCode({ url: data.url, method: data.method, type: data.type, statusCode }, this.state.domain);

  public displayedColumns = ['type', 'method', 'url', 'activeStatusCode', 'actions'];
  public selection = new SelectionModel<number>(true);
  public defaultList: number[];
  public hitcount: number[] = [];
  public disabled = false;
  private timeoutId: number;
  private isBusyAnimating = false;

  subscriptions: Subscription[] = [];

  public viewList: number[];

  public data: IData[];

  @ViewChildren('animatedRow', { read: ElementRef }) rows: QueryList<ElementRef>;

  constructor(
    private appState: AppStateService,
    private store: Store,
    private toast: HotToastService) { }

  ngOnInit(): void {
    this.subscriptions.push(this.appState.hit$.subscribe((data: IData) => {
      const index = this.data.indexOf(data);
      const hitIndex = this.viewList.indexOf(index);

      if (this.state.toggles.hits) {
        this.viewList = arrayMoveItem(this.viewList, hitIndex, 0);
      }

      this.hitcount[hitIndex] = (this.hitcount[hitIndex] || 0) + 1;
      this.isBusyAnimating = true;
    }));
  }

  ngOnChanges(): void {
    this.timeoutId && clearTimeout(this.timeoutId);

    this.timeoutId = setTimeout(() => {
      // The hit list has animated its change. The problem after the animation  rows
      // are moved around with css `transform` which doesn't work with Drag&Drop.
      // So, below we change the order of the data, so no css transformation are needed
      // anymore
      this.isBusyAnimating = false;

      if (!this.state) { // It happens (Explore-state)
        return;
      }

      const viewList = this.state.views[this.state.toggles.hits ? 'hits' : 'normal'] || [];

      // Self healing!!
      if (isViewValidate(viewList, this.state.data)) { // It happens too, super weird
        this.data = viewList.map(v => this.state.data[v]);
        this.viewList = this.data.map((v, i) => i);
      } else {
        console.warn(`The view "${this.state.toggles.hits ? 'hits' : 'normal'} is in an invalid state (${this.state.domain})`, viewList);

        this.viewReset(this.state.toggles.hits ? 'hits' : 'normal');
        this.data = this.state.data;
        this.viewList = this.data.map((_, i) => i);
      }

    }, this.isBusyAnimating ? 1000 : 0);
  }

  ngOnDestroy(): void {
  }

  onActivateToggle(rowIndex: number, event: MouseEvent): void {
    event.stopPropagation();
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

  onDelete(rowIndex: number, event): void {
    event.stopPropagation();

    const index = this.state.data.indexOf(this.data[rowIndex]);
    let msg = `Deleted mock ${this.data[index].url}`;
    if (this.state.domain) {
      msg += ` on domain ${this.state.domain}`;
    }
    this.toast.success(msg, { duration: 2000, style: {} });
    this.deleteData(index);
  }

  onClone(rowIndex: number, event): void {
    event.stopPropagation();
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

  onDataClick(data: IData, index: number): void {
    this.selection.toggle(index);
    this.select.emit(this.state.data.indexOf(data));
  }

  onExport(rowIndex: number, event: MouseEvent): void {
    event.stopPropagation()
    const data = this.data[rowIndex];
    const state = this.getActiveStateSnapshot();
    this.dataExport.emit(state.data.indexOf(data));
    this.selection.toggle(rowIndex);
  }

  public selectAll(): void {
    this.state.data.forEach((d, i) => {
      this.selection.select(i);
    });
  }

  public deselectAll(): void {
    this.selection.clear();
  }

  trackBy(index, row): string {
    return row.type + row.method + row.url;
  }

  drop(event: CdkDragDrop<unknown>): void {
    this.viewReorder(this.state.toggles.hits ? 'hits' : 'normal', event.previousIndex, event.currentIndex);
  }

  private getActiveStateSnapshot(): IState {
    return this.store.selectSnapshot<IState>((state: IStore) => OhMyState.getActiveState(state));
  }
}

