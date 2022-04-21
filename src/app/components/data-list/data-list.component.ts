import { SelectionModel } from '@angular/cdk/collections';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, HostBinding, Input, OnChanges, OnDestroy, OnInit, Output } from '@angular/core';
import { HotToastService } from '@ngneat/hot-toast';
import { style, animate } from "@angular/animations";

// import { findAutoActiveMock } from 'src/app/utils/data';
import { IData, IOhMyContext, IState, ohMyDataId } from '@shared/type';
import { debounceTime, Subscription } from 'rxjs';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { presetInfo } from 'src/app/constants';
import { OhMyState } from 'src/app/services/oh-my-store';
import { deepSearch } from '@shared/utils/deep-search';

export const highlightSeq = [
  style({ backgroundColor: '*' }),
  animate('1s ease-in', style({ backgroundColor: '{{color}}' })),
  animate('1s ease-out', style({ backgroundColor: '*' }))
];

interface IDataView extends IData {
  urlStart: string;
  urlEnd: string;
}
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
export class DataListComponent implements OnInit, OnChanges, OnDestroy {
  @Input() state: IState;
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

  public selection = new SelectionModel<number>(true);
  public defaultList: number[];
  public hitcount: number[] = [];
  public visibleBtns = 1;
  public disabled = false;
  public presetInfo = presetInfo;

  subscriptions = new Subscription();
  filterCtrl = new FormControl('');
  filteredDataList: IDataView[];

  public viewList: ohMyDataId[];
  scenarioOptions: string[] = [];
  presets: string[];
  isPresetCopy = false;

  public data: Record<ohMyDataId, IData>;

  constructor(
    public dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private toast: HotToastService,
    private storeService: OhMyState) { }

  ngOnInit() {
    let filterDebounceId;
    this.filterCtrl.valueChanges.pipe(debounceTime(500)).subscribe(async filter => {
      this.state.aux.filterKeywords = filter;
      this.filteredDataList = (await this.filterListByKeywords()).map(dataToView)
      this.filteredList.emit(this.filteredDataList);

      if (!this.persistFilter) {
        return;
      }

      if (this.state.context.domain === this.context.domain) {
        clearTimeout(filterDebounceId);
        filterDebounceId = window.setTimeout(() => {
          this.storeService.updateAux({ filterKeywords: filter.toLowerCase() }, this.context);
        }, 500);
      }
    });

    this.filterCtrl.setValue(this.state.aux.filterKeywords, { emitEvent: false });
  }

  async ngOnChanges() {
    if (this.state) {
      if (!this.context) {
        this.context = this.state.context;
      }

      this.filteredDataList = (await this.filterListByKeywords()).map(dataToView)

      this.filteredList.emit(this.filteredDataList);
      this.cdr.detectChanges();
    }
  }

  onToggleActivateNew(toggle: boolean): void {
    this.storeService.updateAux({ newAutoActivate: toggle }, this.context);
  }

  async filterListByKeywords(): Promise<IData[]> {
    const data = Object.values(this.state.data).sort((a, b) => a.lastHit > b.lastHit ? -1 : 1);
    const input = this.state.aux.filterKeywords as string;

    if (input === '' || input === undefined || input === null) {
      return data;
    }

    const quotedRe = /(?<=")([^"]+)(?=")(\s|\b)/gi;
    const rmQuotedRe = /"[^"]+"\s{0,}/g;

    const qwords = input.match(quotedRe) || [];
    const words = input.replace(rmQuotedRe, '').split(' ');
    const terms = [...qwords, ...words].filter(t => !!t);

    const filtered = data.filter((d: IData) =>
      terms
        .filter(v => v !== undefined && v !== '')
        .some(v => {
          const x = d.url.toLowerCase().includes(v) ||
            d.requestType.toLowerCase().includes(v) ||
            d.method?.toLowerCase().includes(v)
          return x;
        })
    );

    let out = data.filter(d => !filtered.includes(d));
    out = await deepSearch(out, terms);
    return filtered.concat(await deepSearch(out, terms));
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
      const isActive = data.enabled[this.state.context.preset];
      this.storeService.upsertRequest({
        ...data, enabled:
          { ...data.enabled, [this.context.preset]: !isActive }
      }, this.context);
    }
  }

  async onDelete(id: ohMyDataId, event) {
    event.stopPropagation();

    const data = this.state.data[id];

    // If you click delete fast enough, you can hit it twice
    if (data) { // Is this needed
      this.toast.success('Deleted request', { duration: 2000, style: {} });
      this.state = await this.storeService.deleteRequest(data, this.context);
    }
  }

  onClone(id: ohMyDataId, event): void {
    event.stopPropagation();

    this.storeService.cloneRequest(id, this.state.context, this.context);
    this.toast.success('Cloned ' + this.state.data.url);
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
    this.storeService.updateAux({ blurImages: !this.state.aux.blurImages }, this.context);
  }

  public selectAll(): void {
    Object.keys(this.state.data).forEach((d, i) => {
      this.selection.select(i);
    });
    this.cdr.detectChanges();
  }

  public deselectAll(): void {
    this.selection.clear();
    this.cdr.detectChanges();
  }

  onActivateAll(isActive: boolean): void {
    this.state = { ...this.state, data: { ...this.state.data } };
    Object.values(this.state.data).forEach(d => {
      if (d.selected[this.state.context.preset]) {
        d = { ...d, enabled: { ...d.enabled, [this.state.context.preset]: isActive } };
        this.state.data[d.id] = d;
      }
    });

    // NOTE: It is not this.context!!!!!
    this.storeService.upsertState(this.state, this.state.context);
  }

  trackBy(index, row): string {
    return row.id; // type + row.method + row.url;
  }
}

export function dataToView(row: IData): IDataView {
  return {
    ...row,
    urlStart: row.url.substring(0, row.url.length / 2),
    urlEnd: row.url.substring(row.url.length / 2)
  }
}
