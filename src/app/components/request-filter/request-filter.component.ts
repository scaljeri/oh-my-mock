import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { IOhMyRequest, IOhMyResponse, IOhMyRequestId, IOhMyResponseId } from '@shared/types';
import { BehaviorSubject, debounceTime, filter, map, merge, Observable, of, Subscription, switchMap } from 'rxjs';
import { WebWorkerService } from '../../services/web-worker.service';
import { shallowSearch, splitIntoSearchTerms, transformFilterOptions } from '@shared/utils/search';
import { OhMyState } from '../../services/oh-my-store';
import { FILTER_SEARCH_OPTIONS } from '@shared/constants';

type SearchFilterData = {
  words: string[],
  data: Record<IOhMyRequestId, IOhMyRequest>,
  mocks?: Record<IOhMyResponseId, IOhMyResponse>,
  includes: Record<string, boolean>
};

@Component({
  selector: 'oh-my-request-filter',
  templateUrl: './request-filter.component.html',
  styleUrls: ['./request-filter.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestFilterComponent implements OnInit, OnDestroy {
  @Input() data: Record<IOhMyRequestId, IOhMyRequest>;
  @Input() filterOptions: Record<string, boolean>;
  @Input() filterStr: string;
  @Input() lastResult: string[];

  @Output() filteredData = new EventEmitter<string[]>();
  @Output() updateFilterOptions = new EventEmitter<Record<string, boolean>>();
  @Output() updateFilterStr = new EventEmitter<string>();
  @Output() update = new EventEmitter();

  filterCtrl = new UntypedFormControl('');
  filterOptionsData = FILTER_SEARCH_OPTIONS;
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

    if (!this.filterOptions || Object.keys(this.filterOptions).length !== FILTER_SEARCH_OPTIONS.length) {
      this.setFilterOptions();
    }

    this.subs.add(merge(
      this.filterTrigger$.pipe(
        debounceTime(50),
        filter(x => x !== undefined),
        map(() => this.filterCtrl.value),
      ),
      this.filterCtrl.valueChanges.pipe(
        debounceTime(300)
      ),
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
      switchMap<SearchFilterData, Observable<IOhMyRequest[]>>(input => this.deepSearch(input))
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
    try {

      if (filterStr?.currentValue !== undefined && (filterStr.currentValue === '' || !this.filterCtrl.value.match(filterStr?.currentValue))) {
        this.filterCtrl.setValue(filterStr?.currentValue, { emitEvent: false });
      } else if (!filterStr && !filterStr?.currentValue && !this.filterCtrl.value) {
        return;
      }

      if (!this.filterOptions) {
        this.setFilterOptions();
      }

      if (data || lastResult && !lastResult.currentValue) {
        this.filterTrigger$.next(null);
      }
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

  deepSearch(input: SearchFilterData): Observable<IOhMyRequest[]> {
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

  setFilterOptions() {
    this.filterOptions = FILTER_SEARCH_OPTIONS.reduce((acc, fo) => {
      acc[fo.id] = this.filterOptions?.[fo.id] || true;
      return acc;
    }, {});
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}
