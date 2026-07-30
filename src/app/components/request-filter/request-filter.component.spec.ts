import { CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatMenuModule } from '@angular/material/menu';
import { WebWorkerService } from '../../services/web-worker.service';

import { RequestFilterComponent } from './request-filter.component';

describe('RequestFilterComponent', () => {
  let component: RequestFilterComponent;
  let fixture: ComponentFixture<RequestFilterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatMenuModule, RequestFilterComponent],
      providers: [
        { provide: WebWorkerService, useValue: {} }
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
