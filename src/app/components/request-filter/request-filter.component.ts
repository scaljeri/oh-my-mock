import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  inject
} from '@angular/core';
import {
  UntypedFormControl,
  ReactiveFormsModule,
  FormsModule
} from '@angular/forms';
import { IData, IMock, ohMyDataId, ohMyMockId } from '@shared/type';
import {
  BehaviorSubject,
  debounceTime,
  filter,
  map,
  merge,
  Observable,
  of,
  Subscription,
  switchMap
} from 'rxjs';
import { WebWorkerService } from '../../services/web-worker.service';
import {
  shallowSearch,
  splitIntoSearchTerms,
  transformFilterOptions
} from '@shared/utils/search';
import { OhMyState } from '../../services/oh-my-store';
import { FILTER_SEARCH_OPTIONS } from '@shared/constants';
import { NgClass } from '@angular/common';
import { MatFormField, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { MatMenuTrigger, MatMenu } from '@angular/material/menu';
import { MatCheckbox } from '@angular/material/checkbox';

type SearchFilterData = {
  words: string[];
  data: Record<ohMyDataId, IData>;
  mocks?: Record<ohMyMockId, IMock>;
  includes: Record<string, boolean>;
};

@Component({
  selector: 'oh-my-request-filter',
  templateUrl: './request-filter.component.html',
  styleUrls: ['./request-filter.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgClass,
    MatFormField,
    MatInput,
    ReactiveFormsModule,
    MatIconButton,
    MatSuffix,
    MatIcon,
    MatTooltip,
    MatMenuTrigger,
    MatMenu,
    MatCheckbox,
    FormsModule
  ]
})
export class RequestFilterComponent implements OnInit, OnChanges, OnDestroy {
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  private webWorkerService = inject(WebWorkerService);
  private storeService = inject(OhMyState);

  @Input() data!: Record<ohMyDataId, IData>;
  @Input() filterOptions: Record<string, boolean> | undefined;
  @Input() filterStr: string | undefined;
  @Input() lastResult: string[] | undefined;

  @Output() filteredData = new EventEmitter<string[]>();
  @Output() updateFilterOptions = new EventEmitter<Record<string, boolean>>();
  @Output() updateFilterStr = new EventEmitter<string>();
  @Output() update = new EventEmitter();

  filterCtrl = new UntypedFormControl('');
  filterOptionsData = FILTER_SEARCH_OPTIONS;
  filterMappedOpts!: Record<string, boolean>;
  // A bare trigger: subscribers react to the emission, not to its value.
  filterTrigger$ = new BehaviorSubject<void>(undefined);

  private subs = new Subscription();

  ngOnInit(): void {
    this.subs.add(
      this.filterCtrl.valueChanges.pipe(debounceTime(100)).subscribe(() => {
        this.cdr.detectChanges();
      })
    );

    if (
      !this.filterOptions ||
      Object.keys(this.filterOptions).length !== FILTER_SEARCH_OPTIONS.length
    ) {
      this.setFilterOptions();
    }

    this.subs.add(
      merge(
        this.filterTrigger$.pipe(
          debounceTime(50),
          filter((x) => x !== undefined),
          map(() => this.filterCtrl.value)
        ),
        this.filterCtrl.valueChanges.pipe(debounceTime(300))
        // this.webWorkerService.mockUpsert$.pipe(debounceTime(50),)
      )
        .pipe(
          map<string, SearchFilterData>(
            () =>
              ({
                words: splitIntoSearchTerms(this.filterCtrl.value),
                data: this.data,
                includes: this.filterMappedOpts
              }) as SearchFilterData
          ),
          map<SearchFilterData, SearchFilterData>((input) =>
            this.localSearch(input)
          ),
          switchMap<SearchFilterData, Observable<IData[]>>((input) =>
            this.deepSearch(input)
          )
        )
        .subscribe((data) => {
          this.ngZone.run(() => {
            this.update.emit({
              filterKeywords: this.filterCtrl.value,
              filteredRequests: data.map((d) => d.id),
              filterOptions: this.filterOptions
            });

            // this.updateFilterStr.emit(this.filterCtrl.value);
            // this.filteredData.emit(data.map(d => d.id))
          });
        })
    );

    this.filterMappedOpts = transformFilterOptions(this.filterOptions);
    this.filterCtrl.setValue(this.filterStr, { emitEvent: false });
  }

  ngOnChanges({ filterStr, lastResult, data }: SimpleChanges): void {
    try {
      if (
        filterStr?.currentValue !== undefined &&
        (filterStr.currentValue === '' ||
          !this.filterCtrl.value.match(filterStr?.currentValue))
      ) {
        this.filterCtrl.setValue(filterStr?.currentValue, { emitEvent: false });
      } else if (!filterStr && !this.filterCtrl.value) {
        return;
      }

      if (!this.filterOptions) {
        this.setFilterOptions();
      }

      if (data || (lastResult && !lastResult.currentValue)) {
        this.filterTrigger$.next();
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log('Ooops', err);
    }
  }

  /**
   * A checkbox in the filter menu was ticked. Which one is not passed in:
   * `[(ngModel)]` has already written it into `filterOptions`, and the search
   * reads the whole map.
   */
  onFilterOption(): void {
    this.filterMappedOpts = transformFilterOptions(this.filterOptions);
    this.filterTrigger$.next();
  }

  // Returns SearchFilterData with `data` holding the items that did not match
  localSearch(input: SearchFilterData): SearchFilterData {
    if (input.words.length === 0) {
      input.data = {}; // Everything matched
      return input;
    }

    const results = shallowSearch(input.data, input.words, input.includes);
    const opposite = Object.fromEntries(
      Object.entries(this.data).filter(([id]) => !results[id])
    );

    return {
      words: input.words,
      data: opposite,
      includes: input.includes
    } as SearchFilterData;
  }

  deepSearch(input: SearchFilterData): Observable<IData[]> {
    if (input.words.length === 0) {
      return of(Object.values(this.data));
    }

    return this.webWorkerService
      .search(input.data, input.words, input.includes)
      .pipe(
        map((output: string[]) => {
          const out = Object.values(this.data).filter(
            (item) =>
              !item.id || output.includes(item.id) || !input.data[item.id]
          );
          return out;
        })
      );
  }

  setFilterOptions() {
    this.filterOptions = FILTER_SEARCH_OPTIONS.reduce(
      (acc: Record<string, boolean>, fo) => {
        acc[fo.id] = this.filterOptions?.[fo.id] || true;
        return acc;
      },
      {}
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}
