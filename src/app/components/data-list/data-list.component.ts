import { SelectionModel } from '@angular/cdk/collections';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, HostBinding, Input, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { HotToastService } from '@ngxpert/hot-toast';
import { style, animate } from "@angular/animations";

// import { findAutoActiveMock } from 'src/app/utils/data';
import { IData, IMock, IOhMyContext, IOhMyRequests, IState, ohMyDataId } from '@shared/type';
import { StateUtils } from '@shared/utils/state';
import { BehaviorSubject, combineLatest, debounceTime, filter, Subject, Subscription } from 'rxjs';
import { UntypedFormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { presetInfo } from '../../constants';
import { OhMyState } from '../../services/oh-my-store';
import { WebWorkerService } from '../../services/web-worker.service';
import { RequestFilterComponent } from '../request-filter/request-filter.component';

export const highlightSeq = [
  style({ backgroundColor: '*' }),
  animate('1s ease-in', style({ backgroundColor: '{{color}}' })),
  animate('1s ease-out', style({ backgroundColor: '*' }))
];

// type SearchFilterData = { words: string[], data: Record<string, IData>, mocks?: Record<string, IMock>, includes: Record<string, boolean> };

@Component({
  standalone: false,
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
  stateSubject = new BehaviorSubject<IState | undefined>(undefined);
  state$ = this.stateSubject.asObservable().pipe(filter(s => !!s), debounceTime(50));

  /**
   * The loaded state.
   *
   * The subject starts undefined and every handler below runs only after the
   * list has rendered, which cannot happen before the state arrives. Asserting
   * that once here beats a non-null assertion at each of the dozen call sites.
   */
  private get loadedState(): IState {
    return this.stateSubject.value as IState;
  }
  @Input() set state(s: IState) {
    if (s) {
      this.stateSubject.next(s);
    }
  }

  /**
   * Every request record the caller knows about, by id.
   *
   * Requests are no longer part of the state, so the list needs them handed to
   * it separately. The map may span domains — the state explorer holds the
   * requests of two — which is why `data` below is narrowed to `state`.
   */
  @Input() set requests(r: IOhMyRequests) {
    if (r) {
      this.requestsSubject.next(r);
    }
  }
  private requestsSubject = new BehaviorSubject<IOhMyRequests>({});

  @Input() context!: IOhMyContext; // context !== state,context (but it can be)
  @Input() showDelete!: boolean;
  @Input() showClone!: boolean;
  @Input() showActivate!: boolean;
  @Input() showExport!: boolean;
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

  @ViewChild(RequestFilterComponent) filterComp!: RequestFilterComponent;

  public selection = new SelectionModel<number>(true);
  public defaultList!: number[];
  public hitcount: number[] = [];
  public visibleBtns = 1;
  public disabled = false;
  public presetInfo = presetInfo;


  blurImages = false;
  subscriptions = new Subscription();
  filterCtrl = new UntypedFormControl('');
  // filteredDataList: IDataView[];
  mocks!: Record<string, IMock>;
  requestCount = 0;
  filteredRequests: string[] | undefined;
  newAutoActivate = true;

  public viewList!: ohMyDataId[];
  scenarioOptions: string[] = [];
  presets!: string[];
  isPresetCopy = false;
  hasFilterOptionsChanged = false;

  isSearching = false;
  /** This state's requests, by id — the input map narrowed to one domain. */
  public data: IOhMyRequests = {};
  worker!: Worker;
  private workerTimeoutId!: number;
  searchSubj = new Subject();
  filterOptionsCtrl = new UntypedFormControl();
  filterOptions: Record<string, boolean> | undefined = undefined;
  filterKeywords = '';

  constructor(
    public dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private toast: HotToastService,
    private storeService: OhMyState) { }

  async ngOnInit() {
    this.persistFilter = this.persistFilter ?? this.stateSubject.value?.context.domain === this.context.domain;

    if (!this.persistFilter) {
      this.filterOptions = undefined;
      this.filterKeywords = '';
      this.filteredRequests = [...this.loadedState.requests];
    }

    this.subscriptions.add(combineLatest([this.state$, this.requestsSubject]).subscribe(([state, requests]) => {
      this.data = StateUtils.pickRequests(state, requests);

      if (this.persistFilter) {
        this.filterKeywords = state.aux.filterKeywords || '';
        if (!state.aux.filterKeywords) {
          this.filteredRequests = [...state.requests];
        } else {
          this.filteredRequests = undefined;

          if (state.aux.filteredRequests) {
            this.filteredRequests = state.aux.filteredRequests;
          } else if (state.aux.filteredRequests !== null) {
            this.filteredRequests = [...state.requests];
          }
        }

        this.cdr.detectChanges();
      }

      if (!this.context) {
        this.context = state?.context;
      }

      this.newAutoActivate = state.aux.newAutoActivate ?? false;
      this.filterOptions = state.aux.filterOptions;
      this.requestCount = state.requests.length;
      this.blurImages = state.aux.blurImages ?? false;

      setTimeout(() => {
        this.cdr.detectChanges();
      }, 50);
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
    const data = this.data[id];

    if (!Object.keys(data.mocks).length) {
      this.toast.error(`Could not activate, there are no responses available`);
    } else {
      const isActive = data.enabled[this.loadedState.context.preset];
      this.storeService.upsertRequest({
        ...data, enabled:
          { ...data.enabled, [this.context.preset]: !isActive }
      }, this.context);
    }
  }

  async onDelete(id: ohMyDataId, event: MouseEvent) {
    event.stopPropagation();

    const data = this.data[id];

    // If you click delete fast enough, you can hit it twice
    if (data) { // Is this needed
      this.toast.success('Deleted request', { duration: 2000, style: {} });
      this.stateSubject.next(await this.storeService.deleteRequest(data, this.context));
    }
  }

  onClone(id: ohMyDataId, event: MouseEvent): void {
    event.stopPropagation();
    const state = this.loadedState;

    this.storeService.cloneRequest(id, state.context, this.context);
    this.toast.success('Cloned ' + this.data[id].url);

    this.cloned.emit(this.data[id]);
  }

  onDataClick(data: IData, index: number): void {
    if (this.togglableRows) {
      this.selection.toggle(index);
      this.selectRow.emit(data.id);
    }
  }

  onExport(data: IData, rowIndex: number, event: MouseEvent): void {
    event.stopPropagation()
    this.dataExport.emit(data);
    this.selection.toggle(rowIndex);
  }

  onBlurImage(): void {
    this.storeService.updateAux({ blurImages: !this.loadedState.aux.blurImages }, this.context);
  }

  public selectAll(): void {
    this.loadedState.requests.forEach((d, i) => {
      this.selection.select(i);
    });
    this.cdr.detectChanges();
  }

  public deselectAll(): void {
    this.selection.clear();
    this.cdr.detectChanges();
  }

  onActivateAll(isActive: boolean): void {
    const state = this.loadedState;
    const preset = state.context.preset;

    // Each request is its own record, so activating them all is a write per
    // request rather than one write of the domain. Only the ones that have a
    // response to serve can be switched on at all.
    // NOTE: It is not this.context!!!!!
    Object.values(this.data)
      .filter(d => d.selected[preset])
      .forEach(d => this.storeService.upsertRequest(
        { ...d, enabled: { ...d.enabled, [preset]: isActive } }, state.context));
  }

  /**
   * What the status pill reads for a row, following the design:
   *
   *   Off          the preset is disabled — the request goes to the server
   *   Passthrough  enabled, but no response is selected to serve
   *   Mocked       enabled and serving a stored response
   */
  rowState(row: IData): 'Mocked' | 'Passthrough' | 'Off' {
    if (!row.enabled[this.context.preset]) {
      return 'Off';
    }

    return row.selected[this.context.preset] ? 'Mocked' : 'Passthrough';
  }

  trackBy(index: number, row: IData): string {
    return row.id ?? ''; // type + row.method + row.url;
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
