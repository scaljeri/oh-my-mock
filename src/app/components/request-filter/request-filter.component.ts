import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormControl } from '@angular/forms';
import { IData, IMock, ohMyDataId, ohMyMockId } from '@shared/type';
import { BehaviorSubject, debounceTime, filter, map, merge, Observable, of, Subject, Subscription, switchMap, tap } from 'rxjs';
import { FILTER_OPTIONS } from '../../app.constants';
import { WebWorkerService } from '../../services/web-worker.service';
import { shallowSearch, splitIntoSearchTerms } from '@shared/utils/search';
import { OhMyState } from 'src/app/services/oh-my-store';

type SearchFilterData = {
  words: string[],
  data: Record<ohMyDataId, IData>,
  mocks?: Record<ohMyMockId, IMock>,
  includes: Record<string, boolean>
};

@Component({
  selector: 'oh-my-request-filter',
  templateUrl: './request-filter.component.html',
  styleUrls: ['./request-filter.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestFilterComponent implements OnInit, OnDestroy {
  @Input() data: Record<ohMyDataId, IData>;
  @Input() filterOptions: Record<string, boolean>;
  @Input() filterStr: string;
  @Input() lastResult: string[];

  @Output() filteredData = new EventEmitter<string[]>();
  @Output() updateFilterOptions = new EventEmitter<Record<string, boolean>>();
  @Output() updateFilterStr = new EventEmitter<string>();
  @Output() update = new EventEmitter();

  filterCtrl = new FormControl('');
  filterOptionsData = FILTER_OPTIONS;
  filterMappedOpts: Record<string, boolean>;
  filterTrigger$ = new BehaviorSubject(undefined);

  private subs = new Subscription();

  constructor(
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    private webWorkerService: WebWorkerService,
    private storeService: OhMyState) { }

  ngOnInit(): void {
    this.subs.add(this.filterCtrl.valueChanges.pipe(debounceTime(100)).subscribe(value => {
      this.cdr.detectChanges();
    }));

    if (!this.filterOptions || !Array.isArray(this.filterOptions) || this.filterOptions.length !== FILTER_OPTIONS.length) {
      this.filterOptions = FILTER_OPTIONS.reduce((acc, fo) => {
        acc[fo.id] = true;
        return acc;
      }, {});
    }

    this.subs.add(merge(
      this.filterTrigger$.pipe(
        debounceTime(50),
        filter(x => x !== undefined),
        map(() => this.filterCtrl.value)
      ),
      this.filterCtrl.valueChanges.pipe(debounceTime(300)),
      // this.webWorkerService.mockUpsert$.pipe(debounceTime(50),)
    ).pipe(
      map<string, SearchFilterData>(() =>
      ({
        words: splitIntoSearchTerms(this.filterCtrl.value),
        data: this.data,
        includes: this.filterMappedOpts
      } as SearchFilterData)
      ),
      map<SearchFilterData, SearchFilterData>(input => this.localSearch(input)),
      switchMap<SearchFilterData, Observable<IData[]>>(input => this.deepSearch(input))
    ).subscribe(data => {
      this.ngZone.run(() => {
        this.update.emit({
          filterKeywords: this.filterCtrl.value,
          filteredRequests: data.map(d => d.id),
          filterOptions: this.filterOptions
        });

        // this.updateFilterStr.emit(this.filterCtrl.value);
        // this.filteredData.emit(data.map(d => d.id))
      });
    }));

    this.filterMappedOpts = transformFilterOptions(this.filterOptions);
    this.filterCtrl.setValue(this.filterStr, { emitEvent: false });
  }

  ngOnChanges({ filterOptions, filterStr, lastResult, data }: SimpleChanges): void {
    console.log('ngOnChanges RequestFiler', lastResult, data);
    try {

      if (!this.filterStr) {
        return;
      }


      // if (filterStr && !filterStr.currentValue) {
      //   this.filterCtrl.setValue(filterStr.currentValue, { emitEvent: false });
      // }

      // if (!thisfilterOptions || !Array.isArray(this.filterOptions) || this.filterOptions.length !== FILTER_OPTIONS.length ||
      // Object.entries(filterOptions.currentValue).filter(([k, v]) => filterOptions.previousValue?.[k] !== v).length > 0) {
      // this.filterTrigger$.next(null);

      // } else if (lastResult && !lastResult.currentValue) {
      if (data || lastResult && !lastResult.currentValue) {
        this.filterTrigger$.next(null);
      }

      // if (filterKeywords.currentValue && !lastResult.currentValue) {
      // this.filterTrigger$.next(null);
      // }

      // if (data && !data.firstChange) {
      //   if (
      //     Object.keys(data.currentValue).length !== Object.keys(data.previousValue || {}).length ||
      //     Object.entries(data.currentValue).filter(([k, v]: [string, IData]) => data.previousValue[k].lastModified !== v.lastModified).length > 0) {
      //     this.filterTrigger$.next(null);
      //   }
      // }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log('Ooops', err)
    }
  }

  onFilterOption(option): void {
    this.filterMappedOpts = transformFilterOptions(this.filterOptions);
    this.filterTrigger$.next(null);

    // this.updateFilterOptions.emit(this.filterOptions);
  }

  // Returns SearchFilterData with `data` holding the items that did not match
  localSearch(input: SearchFilterData): SearchFilterData {
    if (input.words.length === 0) {
      input.data = {} // Everything matched
      return input;
    }

    const results = shallowSearch(input.data, input.words, input.includes);
    const opposite = Object.fromEntries(Object.entries(this.data).filter(([id]) => !results[id]));

    return { words: input.words, data: opposite, includes: input.includes } as SearchFilterData;
  }

  deepSearch(input: SearchFilterData): Observable<IData[]> {
    if (input.words.length === 0) {
      return of(Object.values(this.data));
    }

    return this.webWorkerService.search(input.data, input.words, input.includes)
      .pipe(map((output: string[]) => {
        const out = Object.values(this.data).filter(item => output.includes(item.id) || !input.data[item.id])
        return out;
      }
      ));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}


export function transformFilterOptions(options: Record<string, boolean> = {}): Record<string, boolean> {
  return Object.entries(options).reduce((acc, [k, v]) => {
    acc[FILTER_OPTIONS.find(fo => fo.id === k).value] = v;
    return acc;
  }, {});
}
