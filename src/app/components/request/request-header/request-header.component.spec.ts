import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { IData, IOhMyShallowMock, ohMyMockId } from '@shared/type';
import { OhMyState } from '../../../services/oh-my-store';

import { RequestHeaderComponent } from './request-header.component';

const mocks = (...codes: number[]): Record<ohMyMockId, IOhMyShallowMock> =>
  codes.reduce((acc, code) => ({
    ...acc, [`id-${code}`]: { id: `id-${code}`, statusCode: code }
  }), {} as Record<ohMyMockId, IOhMyShallowMock>);

describe('MockHeaderComponent', () => {
  let component: RequestHeaderComponent;
  let fixture: ComponentFixture<RequestHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RequestHeaderComponent],
      imports: [MatAutocompleteModule],
      providers: [
        { provide: MatDialog, useValue: {} },
        { provide: OhMyState, useValue: {} },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RequestHeaderComponent);
    component = fixture.componentInstance;
    component.request = { mocks: {}, enabled: {}, selected: {} } as unknown as IData;
    component.context = { preset: 'p1', domain: 'example.com' };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('sortMockIds', () => {
    it('orders saved responses by status code, lowest first', () => {
      expect(RequestHeaderComponent.sortMockIds(mocks(500, 200, 404)))
        .toEqual(['id-200', 'id-404', 'id-500']);
    });

    it('copes with a request that has no responses at all', () => {
      expect(RequestHeaderComponent.sortMockIds(undefined)).toEqual([]);
      expect(RequestHeaderComponent.sortMockIds({})).toEqual([]);
    });
  });

  describe('the chip row', () => {
    it('marks the served response as selected', () => {
      component.request = {
        mocks: mocks(200, 500),
        enabled: { p1: true },
        selected: { p1: 'id-500' }
      } as unknown as IData;
      component.ngOnChanges();

      expect(component.chips.map(c => c.isSelected)).toEqual([false, true]);
      expect(component.isPassthrough).toBe(false);
    });

    it('selects nothing while the request is switched off for this preset', () => {
      component.request = {
        mocks: mocks(200),
        enabled: { p1: false },
        selected: { p1: 'id-200' }
      } as unknown as IData;
      component.ngOnChanges();

      expect(component.chips.map(c => c.isSelected)).toEqual([false]);
      expect(component.isPassthrough).toBe(true);
    });

    it('selects nothing when the selected response was deleted', () => {
      component.request = {
        mocks: mocks(200),
        enabled: { p1: true },
        selected: { p1: 'id-gone' }
      } as unknown as IData;
      component.ngOnChanges();

      expect(component.activeMockId).toBeUndefined();
      expect(component.isPassthrough).toBe(true);
    });

    it('carries the label of each response', () => {
      component.request = {
        mocks: { a: { id: 'a', statusCode: 200, label: 'Three users' } },
        enabled: {},
        selected: {}
      } as unknown as IData;
      component.ngOnChanges();

      expect(component.chips[0].label).toBe('Three users');
    });
  });

  describe('responseCountLabel', () => {
    it('counts in singular, plural and none', () => {
      component.mockIds = [];
      expect(component.responseCountLabel).toBe('no responses');

      component.mockIds = ['a'];
      expect(component.responseCountLabel).toBe('1 response');

      component.mockIds = ['a', 'b', 'c'];
      expect(component.responseCountLabel).toBe('3 responses');
    });
  });

  it('toggles the inline request editor', () => {
    expect(component.isEditing).toBe(false);
    component.onToggleEdit();
    expect(component.isEditing).toBe(true);
    component.onToggleEdit();
    expect(component.isEditing).toBe(false);
  });
});
