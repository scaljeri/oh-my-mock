import { SelectionModel } from '@angular/cdk/collections';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostBinding,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  inject
} from '@angular/core';
import { HotToastService } from '@ngxpert/hot-toast';
import { style, animate } from '@angular/animations';

// import { findAutoActiveMock } from 'src/app/utils/data';
import {
  IData,
  IMock,
  IOhMyContext,
  IOhMyGroup,
  IOhMyRequests,
  IState,
  ohMyDataId,
  ohMyGroupId
} from '@shared/type';
import { StateUtils } from '@shared/utils/state';
import { visibleRequests } from '@shared/utils/request-index';
import {
  BehaviorSubject,
  combineLatest,
  debounceTime,
  filter,
  Subject,
  Subscription
} from 'rxjs';
import { UntypedFormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { presetInfo } from '../../constants';
import { OhMyStateService } from '../../services/state.service';
import { OhMyState } from '../../services/oh-my-store';
import { RequestFilterComponent } from '../request-filter/request-filter.component';
import {
  IOhMyListRow,
  isTraffic,
  orderRequests,
  pruneSticky,
  sameSticky,
  toggleSticky
} from './data-list.ordering';
import {
  NgClass,
  NgTemplateOutlet,
  LowerCasePipe,
  DatePipe
} from '@angular/common';
import { PresetComponent } from '../preset/preset.component';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatIconButton } from '@angular/material/button';
import { MatMenuTrigger, MatMenu, MatMenuItem } from '@angular/material/menu';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { StatusCodeTonePipe } from '../../pipes/status-code-tone.pipe';

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
  // Deliberately *not* `ComponentsModule`, which the standalone migration
  // added here: that module imports this component, so the two form a cycle
  // and one of them evaluates to `undefined` (TestBed then dies in
  // `isModuleWithProviders`). The template only needs `oh-my-preset` and
  // `oh-my-request-filter`, both listed below.
  imports: [
    NgClass,
    PresetComponent,
    RequestFilterComponent,
    MatSlideToggle,
    MatIconButton,
    MatMenuTrigger,
    MatIcon,
    MatMenu,
    MatMenuItem,
    // The "Active first" toggle has carried a `matTooltip` since the redesign
    // with nothing here to read it: on a standalone component an unimported
    // directive is a plain HTML attribute, so it silently did nothing.
    MatTooltip,
    NgTemplateOutlet,
    LowerCasePipe,
    DatePipe,
    StatusCodeTonePipe
  ]
})
export class DataListComponent implements OnInit, OnDestroy {
  dialog = inject(MatDialog);
  private cdr = inject(ChangeDetectorRef);
  private toast = inject(HotToastService);
  private storeService = inject(OhMyState);
  private stateService = inject(OhMyStateService);

  stateSubject = new BehaviorSubject<IState | undefined>(undefined);
  state$ = this.stateSubject.asObservable().pipe(
    filter((s) => !!s),
    debounceTime(50)
  );

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

  /**
   * The ticked rows, by request id.
   *
   * It used to hold the row *index*, which the list re-sorts on every incoming
   * hit — the highlight then followed the position rather than the request.
   */
  public selection = new SelectionModel<ohMyDataId>(true);
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

  /**
   * The rows as rendered, pinned ones first. Recomputed whenever the state,
   * the requests, the filter, the selection or the pins change — a field
   * rather than a pipe call, so `OnPush` does not rebuild it on every check.
   */
  public viewRows: IOhMyListRow[] = [];

  /**
   * The pinned request ids, in the order they were pinned.
   *
   * Persisted in `aux.stickyRequests` — but only for the domain the popup is
   * actually on, the same condition under which the filter is persisted. The
   * state explorer renders another domain's state through this component, and
   * pinning a row there must not write to that domain's aux.
   */
  public stickyIds: ohMyDataId[] = [];
  /** The pin list last written, until the state carrying it comes back. */
  private awaitingSticky: ohMyDataId[] | undefined;
  /** Whether the list is narrowed to the pinned rows only. */
  public stickyOnly = false;

  /**
   * Whether the list is narrowed to what this browser actually intercepted.
   *
   * **Off by default, and deliberately not persisted** — the list is the
   * library of what can be mocked until someone asks for the traffic view, and
   * it goes back to being the library the next time the popup opens. That is
   * the same treatment `stickyOnly` gets and the opposite of `sortActiveFirst`,
   * and the line between them is whether the control *hides* anything:
   * ordering rows differently is harmless to carry over between sessions,
   * hiding them is not. A remembered traffic mode is precisely how a
   * colleague's forty imported mocks — none of them called, so none of them
   * traffic — become mocks nobody can find.
   */
  /**
   * Whether a state has arrived. The template draws nothing before one has.
   *
   * This used to be `@if (state$ | async; as state)`, and that second
   * subscription is why the list needed a stray re-render to appear at all.
   * `state$` is debounced, and `debounceTime` gives every subscriber its own
   * timer: the async pipe only subscribes when the template first renders,
   * which is *after* `ngOnInit` has subscribed, so the pipe's timer always
   * expires after the one driving the handler in `ngOnInit`. At the moment
   * that handler called `detectChanges()`, the pipe therefore still held
   * nothing, the `@if` was false, and neither the toolbar nor a single row
   * existed — the render went to an empty view and the real one had to be
   * chased by a timer.
   *
   * A flag set by the same handler that renders makes the gate and the render
   * agree by construction, with no clock in between.
   */
  public hasState = false;

  public trafficOnly = false;

  /**
   * When this domain's traffic list was last cleared, from
   * `aux.trafficClearedAt`. Calls before it are not traffic any more; the
   * request records themselves are untouched, which is why Clear cannot cost
   * anybody a mock.
   */
  public trafficClearedAt = 0;

  /** How many of the rows on screen count as traffic — what Clear would empty. */
  public trafficCount = 0;

  /** Which domain `trafficClearedAt` was read for — see `readTrafficCleared`. */
  private trafficDomain: string | undefined;

  /**
   * The known mock groups, by id — what the provenance badge is named from.
   *
   * Kept as a field fed by `groups$` rather than read on demand, because a
   * group's record arrives separately from the state that mentions it: read
   * once at render time, a row would carry a blank badge until the next
   * unrelated state change.
   */
  public groups: Record<ohMyGroupId, IOhMyGroup> = {};

  /**
   * Read from the store rather than kept per domain — it is how the user likes
   * to read the list, not something about one project. Read once here; the
   * popup is the only writer and there is one of it.
   */
  public sortActiveFirst = false;

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

  async ngOnInit() {
    this.persistFilter =
      this.persistFilter ??
      this.stateSubject.value?.context.domain === this.context.domain;

    if (!this.persistFilter) {
      this.filterOptions = undefined;
      this.filterKeywords = '';
      this.filteredRequests = [...this.loadedState.requests];
    }

    this.subscriptions.add(
      combineLatest([
        this.state$,
        this.requestsSubject,
        this.stateService.groups$
      ]).subscribe(
        ([state, requests, groups]) => {
          this.groups = groups;

          // Only the mocks of the groups that are **on**. A group is a set that
          // is switched in or out as a whole; its mocks are not in play while it
          // is off, so they are not in the list either. The way back is the
          // group's own switch in the drawer, not a per-request one.
          this.data = visibleRequests(
            StateUtils.pickRequests(state, requests),
            this.stateService.activeGroups(state),
            this.stateService.localGroup(state)
          );

          if (this.persistFilter) {
            this.filterKeywords = state.aux.filterKeywords || '';
            if (!state.aux.filterKeywords) {
              this.filteredRequests = state.requests.filter(id => !!this.data[id]);
            } else {
              this.filteredRequests = undefined;

              if (state.aux.filteredRequests) {
                this.filteredRequests = state.aux.filteredRequests;
              } else if (state.aux.filteredRequests !== null) {
                this.filteredRequests = state.requests.filter(id => !!this.data[id]);
              }
            }
          }

          if (!this.context) {
            this.context = state?.context;
          }

          this.newAutoActivate = state.aux.newAutoActivate ?? false;
          this.filterOptions = state.aux.filterOptions;
          // Counted from what is on screen, not from the state's id list — a
          // badge that disagrees with the rows below it is worse than no badge.
          this.requestCount = Object.keys(this.data).length;
          this.blurImages = state.aux.blurImages ?? false;
          this.readTrafficCleared(state);

          // After the context fallback above: a write-back needs one.
          if (this.persistFilter) {
            this.readSticky(state);
          }

          // Ordering last: it reads the filter, the requests and the pins, all of
          // which the lines above may just have changed.
          // First, because it is what opens the template's gate: everything
          // set below is only rendered once this is true.
          this.hasState = true;

          this.recompute();
          this.cdr.detectChanges();

        }
      )
    );

    this.applyStoredSort();
  }

  /**
   * Rebuilds the rendered rows from whatever changed.
   *
   * Every ordering rule lives in `orderRequests`; this only feeds it. Pins are
   * pruned against the domain's request ids first, so a pin left over from a
   * deleted request cannot linger in the count or in sticky-only mode.
   */
  private recompute(): void {
    const state = this.stateSubject.value;

    if (state) {
      this.stickyIds = pruneSticky(this.stickyIds, state.requests);
    }

    if (!this.stickyIds.length) {
      this.stickyOnly = false;
    }

    // Counted over every row in play, not over `viewRows`, so the number on the
    // toggle says how much traffic there *is* rather than how much of it the
    // search filter is currently letting through.
    this.trafficCount = Object.values(this.data).filter(d =>
      isTraffic(d, this.trafficClearedAt)
    ).length;

    this.viewRows = orderRequests({
      filtered: this.filteredRequests,
      requests: this.data,
      sticky: this.stickyIds,
      selected: this.selection.selected,
      stickyOnly: this.stickyOnly,
      trafficOnly: this.trafficOnly,
      trafficClearedAt: this.trafficClearedAt,
      activeFirst: this.sortActiveFirst,
      groups: this.groups,
      local: this.stateService.localGroup(this.stateSubject.value),
      context: this.context
    });
  }

  /**
   * Takes the pins from the state that just arrived.
   *
   * The stored list is pruned against the domain's requests on the way in, and
   * written back only when that actually removed something — otherwise every
   * state change would trigger a write, which triggers a state change. Pruning
   * here rather than only on delete is what stops the stored list from
   * collecting ids of requests that are long gone.
   */
  private readSticky(state: IState): void {
    const stored = state.aux.stickyRequests ?? [];

    if (this.awaitingSticky) {
      if (!sameSticky(stored, this.awaitingSticky)) {
        // A write of ours is still in flight, so this state predates it.
        // Taking its list would undo the pin that is on its way out.
        return;
      }

      this.awaitingSticky = undefined;
    }

    const live = pruneSticky(stored, state.requests);

    this.stickyIds = live;

    if (live.length !== stored.length) {
      this.writeSticky(live);
    }
  }

  /**
   * Takes the traffic-clear marker from the state that just arrived.
   *
   * Never backwards, within a domain. `updateAux` travels to the background and
   * comes back through storage, and any state emitted in that window still
   * carries the *old* marker — taking it would repopulate the list with the
   * traffic that was just cleared and then empty it again a moment later.
   * `readSticky` guards the same race with an in-flight copy of what it sent;
   * this needs nothing so elaborate, because clearing only ever moves forward,
   * which makes "the later of the two" right in every case.
   *
   * Across domains it is not monotonic — each domain has its own marker, and
   * carrying one domain's forward would hide traffic that another domain never
   * cleared. So a change of domain takes the new state's value as it stands.
   */
  private readTrafficCleared(state: IState): void {
    const stored = state.aux.trafficClearedAt ?? 0;

    if (state.domain !== this.trafficDomain) {
      this.trafficDomain = state.domain;
      this.trafficClearedAt = stored;

      return;
    }

    this.trafficClearedAt = Math.max(this.trafficClearedAt, stored);
  }

  /**
   * Stores the pins, and remembers what was sent.
   *
   * A write travels to the background and comes back as a fresh state; until
   * it does, every state still carries the previous list — see `readSticky`.
   */
  private writeSticky(sticky: ohMyDataId[]): void {
    this.awaitingSticky = sticky;
    this.storeService.updateAux({ stickyRequests: sticky }, this.context);
  }

  /** Pins a row to the top of the list, or unpins it. */
  onToggleSticky(id: ohMyDataId, event: MouseEvent): void {
    event.stopPropagation();

    this.stickyIds = toggleSticky(this.stickyIds, id);

    if (this.persistFilter) {
      this.writeSticky(this.stickyIds);
    }

    this.recompute();
    this.cdr.detectChanges();
  }

  onToggleStickyOnly(stickyOnly: boolean): void {
    this.stickyOnly = stickyOnly;
    this.recompute();
    this.cdr.detectChanges();
  }

  /** Narrows the list to what the page actually called, or widens it back. */
  onToggleTrafficOnly(trafficOnly: boolean): void {
    this.trafficOnly = trafficOnly;
    this.recompute();
    this.cdr.detectChanges();
  }

  /**
   * Forgets the traffic, the way a network panel's Clear does.
   *
   * It writes one number — `aux.trafficClearedAt` — and touches no request
   * record at all. That is the point: the mocks are what the user came for, and
   * a Clear button that opened every request to strip a field from it is a
   * Clear button that can lose them to a half-finished pass. Nothing here can
   * reach a mock, so nothing here can delete one. What is cleared is the
   * *view*: a request called again afterwards is back in the list at once.
   *
   * Applied locally before the write lands, for the same reason
   * `onToggleSortActiveFirst` does — the round trip goes through the background
   * and comes back via storage, and a button that only empties the list once
   * that has happened reads as a dead control.
   */
  onClearTraffic(): void {
    this.trafficClearedAt = Date.now();
    this.recompute();
    this.cdr.detectChanges();

    if (this.persistFilter) {
      void this.storeService.updateAux(
        { trafficClearedAt: this.trafficClearedAt },
        this.context
      );
    }
  }

  /**
   * Takes the browser-global sort preference from the store.
   *
   * Deliberately *not* awaited at the top of `ngOnInit`. Doing that put a
   * storage round trip in front of the state subscription set up below, so a
   * state announced in that window was never heard — the pins arrived while
   * nothing was listening and the list came up empty. This reorders when the
   * answer lands instead, which is a frame later at worst and cannot miss
   * anything.
   */
  private applyStoredSort(): void {
    void this.storeService.getStore().then(store => {
      const activeFirst = store?.sortActiveFirst ?? false;

      if (activeFirst !== this.sortActiveFirst) {
        this.sortActiveFirst = activeFirst;
        this.recompute();
        this.cdr.detectChanges();
      }
    });
  }

  onToggleActivateNew(toggle: boolean): void {
    this.storeService.updateAux({ newAutoActivate: toggle }, this.context);
  }

  /**
   * Reorders now and remembers afterwards.
   *
   * The list is redrawn from the local flag rather than from the round trip:
   * `updateStore` goes to the background and comes back through storage, and
   * a toggle that only moves once that has happened reads as a dead control.
   */
  onToggleSortActiveFirst(activeFirst: boolean): void {
    this.sortActiveFirst = activeFirst;
    this.recompute();
    this.cdr.detectChanges();

    void this.storeService.updateStore({ sortActiveFirst: activeFirst });
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
      this.storeService.upsertRequest(
        {
          ...data,
          enabled: { ...data.enabled, [this.context.preset]: !isActive }
        },
        this.context
      );
    }
  }

  async onDelete(id: ohMyDataId, event: MouseEvent) {
    event.stopPropagation();

    const data = this.data[id];

    // If you click delete fast enough, you can hit it twice
    if (data) {
      // Is this needed
      this.toast.success('Deleted request', { duration: 2000, style: {} });
      this.stateSubject.next(
        await this.storeService.deleteRequest(data, this.context)
      );
    }
  }

  onClone(id: ohMyDataId, event: MouseEvent): void {
    event.stopPropagation();
    const state = this.loadedState;

    this.storeService.cloneRequest(id, state.context, this.context);
    this.toast.success('Cloned ' + this.data[id].url);

    this.cloned.emit(this.data[id]);
  }

  /**
   * The keyboard equivalent of clicking a row.
   *
   * Enter and Space, the two keys a control that behaves like a button answers
   * to; Space would scroll the list otherwise. Keys pressed on the pin button
   * inside the row bubble up to here as well, and that button has already
   * handled them — hence the target check.
   *
   * `Event` rather than `KeyboardEvent`: that is what Angular types `$event`
   * as for a key-modified binding such as `(keydown.enter)`.
   */
  onRowKey(row: IData, event: Event): void {
    if (event.target !== event.currentTarget) {
      return;
    }

    event.preventDefault();
    this.onDataClick(row);
  }

  /**
   * Opens a request in the detail pane, and marks its row as the open one.
   *
   * The selection is replaced rather than toggled. It used to toggle, on a
   * `SelectionModel` created with `multiple: true`, so every row ever clicked
   * stayed highlighted and stayed exempt from the filter — you could add to
   * the selection but never move it. There is only ever one request open in
   * the detail pane, which is route-driven, so the highlight beside it is
   * single by definition.
   *
   * The multi-select the model still supports belongs to the JSON export,
   * which drives it through `selectAll` / `deselectAll` and the per-row export
   * button, and which sets `togglableRows` to false so it never comes through
   * here.
   */
  onDataClick(data: IData): void {
    if (!this.togglableRows) {
      return;
    }

    this.selection.clear();
    this.selection.select(data.id);
    // The open row is exempt from the filter, so changing it changes what is
    // on screen.
    this.recompute();
    this.selectRow.emit(data.id);
  }

  onExport(data: IData, event: MouseEvent): void {
    event.stopPropagation();
    this.dataExport.emit(data);
    this.selection.toggle(data.id);
    this.recompute();
  }

  onBlurImage(): void {
    this.storeService.updateAux(
      { blurImages: !this.loadedState.aux.blurImages },
      this.context
    );
  }

  public selectAll(): void {
    // "All" is all the rows on screen — `data`, the group-visible requests —
    // not the state's id list. Selecting from the id list ticked requests the
    // list does not show, and the export then carried mocks of groups that
    // are switched off.
    Object.keys(this.data).forEach((id) => {
      this.selection.select(id);
    });
    this.recompute();
    this.cdr.detectChanges();
  }

  public deselectAll(): void {
    this.selection.clear();
    this.recompute();
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
      .filter((d) => d.selected[preset])
      .forEach((d) =>
        this.storeService.upsertRequest(
          { ...d, enabled: { ...d.enabled, [preset]: isActive } },
          state.context
        )
      );
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
      this.storeService.updateAux({ filterKeywords: str }, this.context);
    }
  }

  onFilterUpdateData(data: string[]): void {
    if (this.persistFilter) {
      this.storeService.updateAux({ filteredRequests: data }, this.context);
    }

    this.filteredRequests = data;
    this.recompute();
  }

  onFilterUpdate(update: Record<string, unknown>): void {
    if (this.persistFilter) {
      this.storeService.updateAux(update, this.context);
    }

    if (this.filteredRequests) {
      this.filteredRequests = update.filteredRequests as string[];
    }

    this.recompute();
    this.cdr.detectChanges();
  }
}
