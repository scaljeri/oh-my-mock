import { CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from '@angular/core';
import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick
} from '@angular/core/testing';
import { MatMenuModule } from '@angular/material/menu';
import { objectTypes, FILTER_SEARCH_OPTIONS } from '@shared/constants';
import { IData } from '@shared/type';
import { WebWorkerService } from '../../services/web-worker.service';

import { of } from 'rxjs';

import { RequestFilterComponent } from './request-filter.component';

const request = (id: string): IData => ({
  id,
  url: `/api/${id}`,
  method: 'GET',
  requestType: 'XHR',
  selected: {},
  enabled: {},
  mocks: {},
  lastHit: 0,
  lastModified: 0,
  version: '3.0.0',
  type: objectTypes.REQUEST
});

describe('RequestFilterComponent', () => {
  let component: RequestFilterComponent;
  let fixture: ComponentFixture<RequestFilterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatMenuModule, RequestFilterComponent],
      providers: [
        // The deep search runs in a web worker; answering "nothing extra
        // matched" keeps the shallow results as the outcome.
        { provide: WebWorkerService, useValue: { search: () => of([]) } }
      ],
      schemas: [NO_ERRORS_SCHEMA, CUSTOM_ELEMENTS_SCHEMA]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RequestFilterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  /**
   * The trigger is a `Subject<void>`, so every emission it will ever carry is
   * `undefined`. The pipeline used to pass it through
   * `filter(x => x !== undefined)`, which therefore dropped every trigger:
   * ticking a filter option did nothing, and with a keyword filter active a
   * newly captured request never made it into the list.
   *
   * The components here are created inside the fakeAsync test rather than in
   * `beforeEach`, so the pipeline's `debounceTime` runs on the fake clock.
   */
  describe('the search trigger', () => {
    function createWithData(): {
      instance: RequestFilterComponent;
      emitted: Record<string, unknown>[];
    } {
      const created = TestBed.createComponent(RequestFilterComponent);
      const instance = created.componentInstance;
      const emitted: Record<string, unknown>[] = [];

      instance.data = { a: request('a') };
      instance.update.subscribe((u: Record<string, unknown>) =>
        emitted.push(u)
      );
      created.detectChanges();

      return { instance, emitted };
    }

    it('runs the initial search — triggers fired before init still count', fakeAsync(() => {
      const { emitted } = createWithData();

      tick(60);

      expect(emitted.length).toBe(1);
      expect(emitted[0].filteredRequests).toEqual(['a']);
    }));

    it('re-runs the search when a filter option is toggled', fakeAsync(() => {
      const { instance, emitted } = createWithData();

      tick(60);
      emitted.length = 0;

      instance.onFilterOption();
      tick(60);

      expect(emitted.length).toBe(1);
      expect(emitted[0].filteredRequests).toEqual(['a']);
    }));

    it('re-runs the search when the data changes — a new capture appears under an active keyword', fakeAsync(() => {
      const { instance, emitted } = createWithData();

      tick(60);
      // A keyword is what makes this path matter: without one the list shows
      // everything anyway (and `ngOnChanges` returns early).
      instance.filterCtrl.setValue('api', { emitEvent: false });
      emitted.length = 0;

      instance.data = { a: request('a'), b: request('b') };
      instance.ngOnChanges({
        data: {
          currentValue: instance.data,
          previousValue: undefined,
          firstChange: false,
          isFirstChange: () => false
        }
      });
      tick(60);

      expect(emitted.length).toBe(1);
      expect(emitted[0].filteredRequests).toEqual(['a', 'b']);
    }));
  });

  describe('setFilterOptions', () => {
    it('keeps an option that was switched off', () => {
      // `|| true` turned a stored `false` back on; only an absent option
      // defaults to on.
      component.filterOptions = { [FILTER_SEARCH_OPTIONS[0].id]: false };

      component.setFilterOptions();

      expect(component.filterOptions[FILTER_SEARCH_OPTIONS[0].id]).toBe(false);
      expect(component.filterOptions[FILTER_SEARCH_OPTIONS[1].id]).toBe(true);
    });
  });

  /**
   * `ngOnChanges` used to run the incoming filter through `String.match`, which
   * compiles its argument as a regular expression — and the filter box is free
   * text. It also read `.match` off `filterCtrl.value`, which is `null` on a
   * reset control. Both threw into a `catch` that logged `'Ooops'` and carried
   * on, so the only visible symptom was a filter that quietly stopped updating.
   */
  describe('ngOnChanges', () => {
    const change = (currentValue: string) => ({
      filterStr: {
        currentValue,
        previousValue: undefined,
        firstChange: false,
        isFirstChange: () => false
      }
    });

    it('accepts a filter that is not a valid regular expression', () => {
      component.filterCtrl.setValue('items');

      expect(() => component.ngOnChanges(change('('))).not.toThrow();
      expect(component.filterCtrl.value).toBe('(');
    });

    it('survives a control that has been reset to null', () => {
      component.filterCtrl.setValue(null);

      expect(() => component.ngOnChanges(change('abc'))).not.toThrow();
      expect(component.filterCtrl.value).toBe('abc');
    });

    it('leaves a value the box already contains alone', () => {
      // The user is mid-word; writing the shorter incoming value would truncate
      // what they have typed.
      component.filterCtrl.setValue('abcdef');
      component.ngOnChanges(change('abc'));

      expect(component.filterCtrl.value).toBe('abcdef');
    });

    it('clears the box on an empty filter', () => {
      component.filterCtrl.setValue('abc');
      component.ngOnChanges(change(''));

      expect(component.filterCtrl.value).toBe('');
    });
  });
});
