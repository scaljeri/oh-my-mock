import { SelectionModel } from '@angular/cdk/collections';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, HostBinding, Input, OnChanges, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { HotToastService } from '@ngneat/hot-toast';
import { style, animate } from "@angular/animations";

// import { findAutoActiveMock } from 'src/app/utils/data';
import { IData, IMock, IOhMyContext, IState, ohMyDataId } from '@shared/type';
import { BehaviorSubject, debounceTime, filter, Subject, Subscription } from 'rxjs';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { presetInfo } from 'src/app/constants';
import { OhMyState } from 'src/app/services/oh-my-store';
import { WebWorkerService } from 'src/app/services/web-worker.service';
import { RequestFilterComponent } from '../request-filter/request-filter.component';

export const highlightSeq = [
  style({ backgroundColor: '*' }),
  animate('1s ease-in', style({ backgroundColor: '{{color}}' })),
  animate('1s ease-out', style({ backgroundColor: '*' }))
];

// type SearchFilterData = { words: string[], data: Record<string, IData>, mocks?: Record<string, IMock>, includes: Record<string, boolean> };

@Component({
  selector: 'oh-my-data-list',
  templateUrl: './data-list.component.html',
  styleUrls: ['./data-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
export class DataListComponent implements OnInit, OnDestroy {
  stateSubject = new BehaviorSubject<IState>(undefined);
  state$ = this.stateSubject.asObservable().pipe(filter(s => !!s), debounceTime(100));
  @Input() set state(s: IState) {
    if (s) {
      this.stateSubject.next(s);
    }
  }

  @Input() context: IOhMyContext; // context !== state,context (but it can be)
  @Input() showDelete: boolean;
  @Input() showClone: boolean;
  @Input() showActivate: boolean;
  @Input() showExport: boolean;
  @Input() showPreset = true;
  @Input() showActivateToggle = true;
  @Input() @HostBinding('class.togglable') togglableRows = true;
  @Input() hideHeader = false;
  @Input() hideFilter = false;
  @Input() persistFilter = true;

  @Input() showMenu = false;

  @Output() selectRow = new EventEmitter<string>();
  @Output() dataExport = new EventEmitter<IData>();
  @Output() filteredList = new EventEmitter<IData[]>();
  @Output() cloned = new EventEmitter<IData>();

  @ViewChild(RequestFilterComponent) filterComp: RequestFilterComponent;

  public selection = new SelectionModel<number>(true);
  public defaultList: number[];
  public hitcount: number[] = [];
  public visibleBtns = 1;
  public disabled = false;
  public presetInfo = presetInfo;


  blurImages = false;
  subscriptions = new Subscription();
  filterCtrl = new FormControl('');
  // filteredDataList: IDataView[];
  mocks: Record<string, IMock>;
  requestCount = 0;
  filteredRequests: string[];

  public viewList: ohMyDataId[];
  scenarioOptions: string[] = [];
  presets: string[];
  isPresetCopy = false;
  hasFilterOptionsChanged = false;

  isSearching = false;
  public data: Record<ohMyDataId, IData>;
  worker: Worker;
  private workerTimeoutId: number;
  searchSubj = new Subject();
  filterOptionsCtrl = new FormControl();
  filterOptions = [];

  constructor(
    public dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private toast: HotToastService,
    private webWorkerService: WebWorkerService,
    private storeService: OhMyState) { }

  async ngOnInit() {
    this.persistFilter = this.persistFilter ?? this.stateSubject.value?.context.domain === this.context.domain;

    this.subscriptions.add(this.state$.subscribe(state => {
      console.log('DL new state', state);

      if (!state.aux.filterKeywords) {
        this.filteredRequests = Object.keys(state.data);
      } else {
        if (state.aux.filteredRequests) {
          this.filteredRequests = state.aux.filteredRequests;
        } else if (state.aux.filteredRequests !== null) {
          this.filteredRequests = Object.keys(state.data);
        }
      }

      if (!this.context) {
        this.context = state?.context;
      }

      this.requestCount = Object.keys(state.data).length;
      this.blurImages = state.aux.blurImages;

      setTimeout(() => {
        this.cdr.detectChanges();
      });
    }));
  }

  onToggleActivateNew(toggle: boolean): void {
    this.storeService.updateAux({ newAutoActivate: toggle }, this.context);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  onActivateToggle(id: ohMyDataId, event: MouseEvent): void {
    event.stopPropagation();
    const data = this.stateSubject.value.data[id];

    if (!Object.keys(data.mocks).length) {
      this.toast.error(`Could not activate, there are no responses available`);
    } else {
      const isActive = data.enabled[this.state.context.preset];
      this.storeService.upsertRequest({
        ...data, enabled:
          { ...data.enabled, [this.context.preset]: !isActive }
      }, this.context);
    }
  }

  async onDelete(id: ohMyDataId, event) {
    event.stopPropagation();

    const data = this.stateSubject.value.data[id];

    // If you click delete fast enough, you can hit it twice
    if (data) { // Is this needed
      this.toast.success('Deleted request', { duration: 2000, style: {} });
      this.stateSubject.next(await this.storeService.deleteRequest(data, this.context));
    }
  }

  onClone(id: ohMyDataId, event): void {
    event.stopPropagation();
    const state = this.stateSubject.value;

    this.storeService.cloneRequest(id, state.context, this.context);
    this.toast.success('Cloned ' + state.data[id].url);

    this.cloned.emit(state.data[id]);
  }

  onDataClick(data: IData, index: number): void {
    if (this.togglableRows) {
      this.selection.toggle(index);
      this.selectRow.emit(data.id);
    }
  }

  onExport(data: IData, rowIndex, event: MouseEvent): void {
    event.stopPropagation()
    this.dataExport.emit(data);
    this.selection.toggle(rowIndex);
  }

  onBlurImage(): void {
    this.storeService.updateAux({ blurImages: !this.stateSubject.value.aux.blurImages }, this.context);
  }

  public selectAll(): void {
    Object.keys(this.stateSubject.value.data).forEach((d, i) => {
      this.selection.select(i);
    });
    this.cdr.detectChanges();
  }

  public deselectAll(): void {
    this.selection.clear();
    this.cdr.detectChanges();
  }

  onActivateAll(isActive: boolean): void {
    const state = { ...this.stateSubject.value, data: { ...this.stateSubject.value.data } };
    Object.values(this.stateSubject.value.data).forEach(d => {
      if (d.selected[this.stateSubject.value.context.preset]) {
        d = { ...d, enabled: { ...d.enabled, [this.stateSubject.value.context.preset]: isActive } };
        state.data[d.id] = d;
      }
    });

    // NOTE: It is not this.context!!!!!
    this.storeService.upsertState(state, state.context);
    this.stateSubject.next(state);
  }

  trackBy(index, row): string {
    return row.id; // type + row.method + row.url;
  }

  // async doSearch(data: Record<string, IData>, terms: string[]): Promise<string[]> {
  //   return this.webWorkerService.search(terms, data);
  // }

  onFilterUpdateOptions(options: Record<string, boolean>): void {
    if (this.persistFilter) {
      this.storeService.updateAux({ filterOptions: options }, this.context);
    }

    // this.state.aux.filterOptions = options;
  }

  onFilterUpdateStr(str: string): void {
    if (this.persistFilter) {
      this.storeService.updateAux({ filterKeywords: str }, this.context)
    }
  }

  onFilterUpdateData(data: string[]): void {
    if (this.persistFilter) {
      this.storeService.updateAux({ filteredRequests: data }, this.context);
    }

    this.filteredRequests = data;
  }

  onFilterUpdate(update: Record<string, unknown>): void {
    if (this.persistFilter) {
      this.storeService.updateAux(update, this.context);
    }

    if (this.filteredRequests) {
      this.filteredRequests = update.filteredRequests as string[];
    }

  }
}
