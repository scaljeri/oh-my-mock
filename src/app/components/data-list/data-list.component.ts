import { SelectionModel } from '@angular/cdk/collections';
import { Component, ElementRef, EventEmitter, HostBinding, Input, OnChanges, OnDestroy, OnInit, Output, QueryList, ViewChildren } from '@angular/core';
import { HotToastService } from '@ngneat/hot-toast';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Store } from '@ngxs/store';
import { style, animate } from "@angular/animations";
import { DeleteData, LoadState, Aux, UpdateState, UpsertData, PresetCreate } from 'src/app/store/actions';

// import { findAutoActiveMock } from 'src/app/utils/data';
import { domain, IData, IOhMyAux, IOhMyContext, IOhMyPresetChange, IState, IStore, ohMyDataId, ohMyPresetId } from 'src/shared/type';
import { AppStateService } from 'src/app/services/app-state.service';
import { Observable, Subscription } from 'rxjs';
import { uniqueId } from '@shared/utils/unique-id';
import { FormControl } from '@angular/forms';
import { STORAGE_KEY } from '@shared/constants';
import { OhMyState } from 'src/app/store/state';
import { MatDialog } from '@angular/material/dialog';
import { PresetUtils } from '@shared/utils/preset';

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

  @Dispatch() updateAux = (values: IOhMyAux) => {
    return new Aux(values);
  }
  @Dispatch() updateContext = (value: Partial<IOhMyContext>) => {
    return new UpdateState({ context: value as IOhMyContext });
  }
  @Dispatch() updateState = (state: IState) => {
    return new UpdateState(state);
  }
  @Dispatch() deleteData = (id: string) => {
    return new DeleteData(id, this.state.domain);
  }
  @Dispatch() upsertData = (data: Partial<IData>) => {
    return new UpsertData(data);
  }
  // @Dispatch() viewReorder = (name: string, id: string, to: number) => {
  //   debugger;
  //   return new ViewChangeOrderItems({ name, id, to });
  // }
  // @Dispatch() viewReset = (name: string) => {
  //   return new ViewReset(name);
  // }

  @Dispatch() loadState = () => {
    return new LoadState(this.domain);
  }
  // @Dispatch() toggleActivityList = (value: boolean) => {
  //   return new Aux({ activityList: value });
  // }

  @Dispatch() toggleActivateNew = (value: boolean) => {
    return new Aux({ newAutoActivate: value });
  }

  @Dispatch() updatePresets = (updates: IOhMyPresetChange[] | IOhMyPresetChange) => {
    return new PresetCreate(updates);
  }

  // public displayedColumns = ['type', 'method', 'url', 'activeMock', 'actions'];
  public selection = new SelectionModel<number>(true);
  public defaultList: number[];
  public hitcount: number[] = [];
  public visibleBtns = 1;
  public disabled = false;

  subscriptions = new Subscription();
  filterCtrl = new FormControl('');
  scenarioCtrl = new FormControl('', { updateOn: 'blur' });
  filteredDataList: IData[];

  public viewList: ohMyDataId[];
  scenarioOptions: string[] = [];
  presets: string[];


  public data: Record<ohMyDataId, IData>;
  private state$: Observable<IState>;

  @ViewChildren('animatedRow', { read: ElementRef }) rows: QueryList<ElementRef>;

  constructor(
    public dialog: MatDialog,
    private appState: AppStateService,
    private store: Store,
    private toast: HotToastService) {
    this.state$ = this.store.select<IState>((store: IStore) => {
      return store[STORAGE_KEY].content.states[this.domain];
    })
  }

  ngOnInit(): void {
    this.scenarioCtrl.valueChanges.subscribe(preset => {
      const oldPresetValue = this.state.presets[this.state.context.preset];

      if (preset !== oldPresetValue) {
        if (preset === '') {
          this.scenarioCtrl.setValue(oldPresetValue, { emitEvent: false });
        } else {
          const id = PresetUtils.findId(this.state.presets, preset);
          this.state.context.preset = id;
          this.updatePresets({ id: id || this.state.context.preset, value: preset, activate: true });
        }
      }
    });

    let filterDebounceId;
    this.filterCtrl.valueChanges.subscribe(filter => {
      // TODO: filter data

      clearTimeout(filterDebounceId);
      filterDebounceId = window.setTimeout(() => {
        this.updateAux({ filterKeywords: filter.toLowerCase() });
      }, 500);
    });

    // this.subscriptions.add(this.state$.subscribe((state: IState) => {
    //   this.state = state;
    //   this.presets = ['a', 'b', 'c']; // Object.values(state.presets) ;
    //   this.filteredDataList = this.filterListByKeywords();

    //   this.scenarioCtrl.setValidators([exactOptionMatchValidator(this.presets)]);

    //   this.scenarioCtrl.setValue(state.context.preset, { emitEvent: false });
    //   // this.scenarioCtrl.setValue(state.scenarios[state.aux.filterScenario], { emitEvent: false });
    //   this.filterCtrl.setValue(state.aux.filterKeywords, { emitEvent: false });
    //   // this.filteredDataList = this.filterListByScenario(this.filterListByKeywords(), this.state.context.scenario);
    // }));

    // if (!this.state) {
    //   this.loadState();
    // }

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
  ngOnChanges(): void {
    this.scenarioCtrl.setValue(this.state.presets[this.state.context.preset]);
    this.presets = Object.values(this.state.presets)
  }

  onToggleActivateNew(toggle: boolean): void {
    this.toggleActivateNew(toggle);
  }

  // ngOnChanges(): void {
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
  // }


  onScenarioUpdate(preset): void {
    const scenarioId = PresetUtils.findId(this.state.presets, preset);

    this.updateContext({ preset });

    // if (!scenarioId) {
    //   this.scenarioCtrl.setValue('', { emitEvent: false });
    // } else {
    //   const state = { ...this.state, data: { ...this.state.data } };

    //   Object.entries(this.state.data).forEach(([id, data]) => {
    //     const result = Object.entries(data.mocks).find(([, mock]) => mock.scenario === scenarioId);

    //     data = { ...data, activeScenarioMock: result ? result[0] : null };
    //     state.data[id] = data;
    //   });

    //   this.updateState(state);
    // }
  }

  onFilterUpdate(): void {
    this.updateAux({ filterKeywords: this.filterCtrl.value.toLowerCase() });
  }

  filterListByScenario(list: IData[], scenarioId: ohMyPresetId): IData[] {
    return null; // list.filter(data => data.mocks[data.activeScenarioMock]?.scenario === scenarioId);
  }

  filterListByKeywords(): IData[] {
    const data = Object.values(this.state.data);
    const input = this.state.aux.filterKeywords as string;

    if (input === '' || input === undefined || input === null) {
      return data;
    }

    const quotedRe = /(?<=")([^"]+)(?=")(\s|\b)/gi;
    const rmQuotedRe = /"[^"]+"\s{0,}/g;

    const qwords = input.match(quotedRe) || [];
    const words = input.replace(rmQuotedRe, '').split(' ');
    const terms = [...qwords, ...words];

    const filtered = data.filter((d: IData) =>
      terms
        .filter(v => v !== undefined && v !== '')
        .some(v =>
          d.url.toLowerCase().includes(v) ||
          d.requestType.toLowerCase().includes(v) ||
          d.method.toLowerCase().includes(v) /*||
          !!d.mocks[d.activeMock]?.statusCode.toString().includes(v) TODO */
          // || !!Object.keys(d.mocks).find(k => d.mocks[k].responseMock?.toLowerCase().includes(v))
        )
    );

    return filtered;
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  onActivateToggle(id: ohMyDataId, event: MouseEvent): void {
    event.stopPropagation();
    const data = this.state.data[id];

    if (!Object.keys(data.mocks).length) {
      this.toast.error(`Could not activate, there are no responses available`);
    } else {
      // this.upsertData({ id, enabled: !data.enabled });
    }
  }

  onDelete(id: ohMyDataId, event): void {
    event.stopPropagation();

    const data = this.state.data[id];

    // If you click delete fast enough, you can hit it twice
    if (data) {
      this.deleteData(id);

      let msg = `Deleted mock ${data.url}`;
      if (this.state.domain) {
        msg += ` in domain ${this.state.domain}`;
      }
      this.toast.success(msg, { duration: 2000, style: {} });
    }
  }

  onClone(id: ohMyDataId, event): void {
    event.stopPropagation();

    const data = {
      ...this.state.data[id],
      id: uniqueId()
    };

    this.upsertData(data);
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
  onPresetCopy(preset: string) {
    const updates = [PresetUtils.create(this.state.presets, preset)];
    this.state.context.preset = updates[0].id;
    this.state.presets[updates[0].id] = updates[0].value;
    this.scenarioCtrl.setValue(updates[0].value, { emitEvent: false});

    let presetId = Object.entries(this.state.presets).find(([, v]) => v === preset)?.[0];

    if (!presetId) { // Update existing preset value
      presetId = this.state.context.preset;

      updates.push({
        id: presetId, value: preset
      });
    }

    this.updatePresets(updates);
  }

  onPresetDelete(preset: string) {
    if (preset === '') {
      return this.toast.warning('Delete failed: no preset selected');
    } else if (Object.keys(this.state.presets).length === 1) {
      return this.toast.warning('Delete failed: cannot delete the last preset');
    }

    const presetId = Object.entries(this.state.presets).find(([, v]) => v === preset)?.[0];

    if (!presetId) {
      this.scenarioCtrl.setValue(this.state.context.preset);
    } else {
      this.updatePresets({ id: presetId, delete: true })
    }
  }

  onBlur(): void {
    if (!this.state.context.preset) {
      const [id, value] = Object.entries(this.state.presets)[0];
      this.updatePresets({ id, value, activate: true });
    }
  }
}

