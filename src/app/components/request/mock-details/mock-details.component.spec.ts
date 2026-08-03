import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { IMock } from '@shared/types/mock';
import { MockDetailsComponent } from './mock-details.component';
import { OhMyState } from '../../../services/oh-my-store';
import { MatDialog } from '@angular/material/dialog';

describe('MockDetailsComponent', () => {
  let component: MockDetailsComponent;
  let fixture: ComponentFixture<MockDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      schemas: [NO_ERRORS_SCHEMA],
      imports: [MatAutocompleteModule, MockDetailsComponent],
      providers: [
        {provide: OhMyState, useValue: {}},
        {provide: MatDialog, useValue: {}}]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MockDetailsComponent);
    component = fixture.componentInstance;
    component.response = { headersMock: {}} as unknown as IMock;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('parseStatusCode', () => {
    it('takes the code out of a picked suggestion', () => {
      expect(component.parseStatusCode('404 Not Found')).toBe(404);
    });

    it('accepts a bare code, typed or already numeric', () => {
      expect(component.parseStatusCode('200')).toBe(200);
      expect(component.parseStatusCode(500)).toBe(500);
    });

    it('returns null for anything without digits, so the stored code stands', () => {
      expect(component.parseStatusCode('')).toBeNull();
      expect(component.parseStatusCode('   ')).toBeNull();
      expect(component.parseStatusCode(null)).toBeNull();
      expect(component.parseStatusCode(undefined)).toBeNull();
    });
  });

  describe('parseDelay', () => {
    it('reads a number of milliseconds', () => {
      expect(component.parseDelay('250')).toBe(250);
      expect(component.parseDelay(0)).toBe(0);
    });

    it('treats an empty or nonsense field as no delay', () => {
      expect(component.parseDelay('')).toBeUndefined();
      expect(component.parseDelay(null)).toBeUndefined();
      expect(component.parseDelay('soon')).toBeUndefined();
      expect(component.parseDelay('-1')).toBeUndefined();
    });
  });

  describe('mergeContentType', () => {
    it('keeps whatever followed the mime type', () => {
      expect(component.mergeContentType('text/html; charset=utf-8', 'application/json'))
        .toBe('application/json; charset=utf-8');
    });

    it('works when nothing was stored yet', () => {
      expect(component.mergeContentType(undefined, 'application/json'))
        .toBe('application/json');
    });
  });

  describe('the cookies button', () => {
    it('counts what the response sets', () => {
      component.response = {
        ...component.response,
        cookies: [
          { name: 'session', value: 'abc' },
          { name: 'theme', value: 'dark' }
        ]
      };

      expect(component.cookieCount).toBe(2);
    });

    it('counts nothing when the response sets none', () => {
      expect(component.cookieCount).toBe(0);
    });
  });
});
