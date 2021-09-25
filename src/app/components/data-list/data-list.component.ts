import { SelectionModel } from '@angular/cdk/collections';
import { Component, ElementRef, EventEmitter, HostBinding, Input, OnChanges, OnDestroy, OnInit, Output, QueryList, ViewChildren } from '@angular/core';
import { HotToastService } from '@ngneat/hot-toast';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Store } from '@ngxs/store';
import { trigger, style, animate, transition } from "@angular/animations";
import { DeleteData, LoadState, Toggle, UpsertData, ViewChangeOrderItems, ViewReset } from 'src/app/store/actions';

// import { findAutoActiveMock } from 'src/app/utils/data';
import { domain, IData, IState, IStore, ohMyDataId, ohMyMockId } from 'src/shared/type';
import { AppStateService } from 'src/app/services/app-state.service';
import { Observable, Subscription } from 'rxjs';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { arrayMoveItem } from '@shared/utils/array';
import { UntilDestroy } from '@ngneat/until-destroy';
import { isViewValidate } from '../../utils/validate-view';
import { uniqueId } from '@shared/utils/unique-id';
import { FormControl } from '@angular/forms';
import { STORAGE_KEY } from '@shared/constants';
import { OhMyState } from 'src/app/store/state';

export const highlightSeq = [
  style({ backgroundColor: '*' }),
  animate('1s ease-in', style({ backgroundColor: '{{color}}' })),
  animate('1s ease-out', style({ backgroundColor: '*' }))
];

@Component({
  selector: 'oh-my-data-list',
  templateUrl: './data-list.component.html',
  styleUrls: ['./data-list.component.scss'],
  // animations: [
  //   trigger("inOutAnimation", [
  //     transition(":leave", [
  //       style({ height: "*", opacity: 1, paddingTop: "*", paddingBottom: "*" }),
  //       animate(
  //         ".7s ease-in",
  //         style({ height: 0, opacity: 0, paddingTop: 0, paddingBottom: 0 })
  //       )
  //     ])
  //   ])
  // ]
})
export class DataListComponent implements OnInit, OnChanges, OnDestroy {
  @Input() domain: domain = OhMyState.domain;
  @Input() state: IState;
  @Input() showDelete: boolean;
  @Input() showClone: boolean;
  @Input() showActivate: boolean;
  @Input() showExport: boolean;
  @Input() @HostBinding('class') theme = 'dark';

  @Output() select = new EventEmitter<string>();
  @Output() dataExport = new EventEmitter<IData>();

  // @Dispatch() deleteData = (id: string) => {
  //   debugger;
  //   return new DeleteData(id, this.state.domain);
  // }
  // @Dispatch() upsertData = (data: IData) => {
  //   debugger;
  //   return new UpsertData(data);
  // }
  // @Dispatch() viewReorder = (name: string, id: string, to: number) => {
  //   debugger;
  //   return new ViewChangeOrderItems({ name, id, to });
  // }
  // @Dispatch() viewReset = (name: string) => {
  //   return new ViewReset(name);
  // }

  @Dispatch() loadState = () => new LoadState(this.domain);
  @Dispatch() toggleActivityList = (value: boolean) => {
    return new Toggle({ name: 'activityList', value });
  }

  @Dispatch() toggleActivateNew = (value: boolean) => {
    return new Toggle({ name: 'activateNew', value });
  }

  // public displayedColumns = ['type', 'method', 'url', 'activeMock', 'actions'];
  public selection = new SelectionModel<number>(true);
  public defaultList: number[];
  public hitcount: number[] = [];
  public visibleBtns = 1;
  public disabled = false;
  private timeoutId: number;
  private isBusyAnimating = false;

  subscriptions = new Subscription();
  filterCtrl = new FormControl('');

  public viewList: number[];


  public data: Record<ohMyDataId, IData>;
  private state$: Observable<IState>;

  @ViewChildren('animatedRow', { read: ElementRef }) rows: QueryList<ElementRef>;

  constructor(
    private appState: AppStateService,
    private store: Store,
    private toast: HotToastService) {
    this.state$ = this.store.select<IState>((store: IStore) => {
      return store[STORAGE_KEY].content.states[this.domain];
    })
  }

  ngOnInit(): void {
    this.subscriptions.add(this.state$.subscribe(state => {
      this.state = state;

      if (this.state) {
        
      }
    }));

    if (!this.state) {
      this.loadState();
    }

    // this.subscriptions.push(this.appState.hit$.subscribe((data: IData) => {
    // const index = this.data.indexOf(data);
    // const hitIndex = this.viewList.indexOf(index);

    // if (this.state.toggles.hits) {
    //   this.viewList = arrayMoveItem(this.viewList, hitIndex, 0);
    // }

    // this.hitcount[hitIndex] = (this.hitcount[hitIndex] || 0) + 1;
    // this.isBusyAnimating = true;
    // }));
  }

  onToggleActivateNew(toggle: boolean): void {
    this.toggleActivateNew(toggle);
  }

  ngOnChanges(): void {
    // this.timeoutId && clearTimeout(this.timeoutId);
    // this.visibleBtns = (this.showActivate ? 1 : 0) + (this.showClone ? 1 : 0) + (this.showDelete ? 1 : 0) + (this.showExport ? 1 : 0);

    // this.timeoutId = window.setTimeout(() => {
    //   // The hit list has animated its change. The problem after the animation  rows
    //   // are moved around with css `transform` which doesn't work with Drag&Drop.
    //   // So, below we change the order of the data, so no css transformation are needed
    //   // anymore
    //   this.isBusyAnimating = false;

    //   if (!this.state) { // It happens (Explore-state)
    //     return;
    //   }

    //   const viewList = this.state.views[this.state.toggles.hits ? 'hits' : 'normal'] || [];

    //   // Self healing!!
    //   if (isViewValidate(viewList as any, this.state.data as any)) { // It happens too, super weird
    //     // this.data = viewList.map(v => this.state.data[v]);
    //     // this.viewList = this.data.map((v, i) => i);
    //   } else {
    //     // eslint-disable-next-line no-console
    //     console.warn(`The view "${this.state.toggles.hits ? 'hits' : 'normal'} is in an invalid state (${this.state.domain})`, viewList);

    //     this.viewReset(this.state.toggles.hits ? 'hits' : 'normal');
    //     this.data = this.state.data;
    //     // this.viewList = this.data.map((_, i) => i);
    //   }

    // }, this.isBusyAnimating ? 1000 : 0);
  }

  getFilteredList(): IData[] {
    return this.state.views.activity.map(id => this.state.data[id]);
    // const input = this.filterCtrl.value.toLowerCase();

    // if (input === "") {
    //   return data;
    // }

    // const quotedRe = /(?<=")([^"]+)(?=")(\s|\b)/gi;
    // const rmQuotedRe = /"[^"]+"\s{0,}/g;

    // const qwords = input.match(quotedRe) || [];
    // const words = input.replace(rmQuotedRe, '').split(' ');

    // const filtered = data.filter(d =>
    //   [...qwords, ...words]
    //     .filter(v => v !== undefined && v !== '')
    //     .some(v =>
    //       d.url.toLowerCase().includes(v) ||
    //       d.type.toLowerCase().includes(v) ||
    //       d.method.toLowerCase().includes(v) ||
    //       !!d.mocks[d.activeMock]?.statusCode.toString().includes(v) ||
    //       !!Object.keys(d.mocks).find(k => d.mocks[k].responseMock?.toLowerCase().includes(v))
    //     )
    // );

    // return filtered;
    return null;
  }

  ngOnDestroy(): void {
  }

  onActivateToggle(id: string, event: MouseEvent): void {
    // event.stopPropagation();

    // const data = findMocks(this.state, { id });

    // if (data.enabled) {
    //   this.upsertData({ id, enabled: false });
    //   this.toast.warning('Mock disabled!');
    // } else {
    //   let mockId = data.activeMock;

    //   if (!data.activeMock) {
    //     mockId = findAutoActiveMock(data) as ohMyMockId;
    //   }

    //   if (mockId) {
    //     this.upsertData({ id, enabled: true, ...(mockId && { activeMock: mockId }) });
    //     this.toast.success(`Mock with status-code ${data.mocks[mockId].statusCode} activated`);
    //   } else {
    //     this.toast.error(`Could not activate, there are no responses available`);
    //   }
    // }
  }

  onDelete(id: string, event): void {
    // event.stopPropagation();
    // const data = findMocks(this.state, { id });

    // // If you click delete fast enough, you can hit it twice
    // if (data) {
    //   let msg = `Deleted mock ${data.url}`;
    //   if (this.state.domain) {
    //     msg += ` on domain ${this.state.domain}`;
    //   }
    //   this.toast.success(msg, { duration: 2000, style: {} });
    //   this.deleteData(id);
    // }
  }

  onClone(rowIndex: number, event): void {
    event.stopPropagation();
    const data = {
      ...this.data[rowIndex], id: uniqueId(),
      enabled: this.state.toggles.activateNew
    };

    // this.upsertData(data);
    this.toast.success('Cloned ' + data.url);
  }

  onDataClick(data: IData, index: number): void {
    this.selection.toggle(index);
    this.select.emit(data.id);
  }

  onExport(data: IData, rowIndex, event: MouseEvent): void {
    event.stopPropagation()
    this.dataExport.emit(data);
    this.selection.toggle(rowIndex);
  }

  public selectAll(): void {
    // this.state.data.forEach((d, i) => {
    //   this.selection.select(i);
    // });
  }

  public deselectAll(): void {
    this.selection.clear();
  }

  trackBy(index, row): string {
    return row.type + row.method + row.url;
  }

  // drop(event: CdkDragDrop<unknown>): void {
  //   if (!this.filterCtrl.value) {
  //     // this.viewReorder(this.state.toggles.hits ? 'hits' : 'normal', event.previousIndex, event.currentIndex);
  //   }
  // }
}

