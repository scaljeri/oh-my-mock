import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { HotToastService } from '@ngxpert/hot-toast';
import { Subject } from 'rxjs';
import { OhMyState } from '../../services/oh-my-store';
import { OhMyStateService } from '../../services/state.service';
import { StorageService } from '../../services/storage.service';
import { RequestComponent } from './request.component';

describe('MockComponent', () => {
  let component: RequestComponent;
  let fixture: ComponentFixture<RequestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        { provide: MatDialog, useValue: {} },
        { provide: Router, useValue: {} },
        { provide: OhMyState, useValue: {} },
        { provide: OhMyStateService, useValue: {response$: new Subject()} },
        { provide: StorageService, useValue: {} },
        { provide: HotToastService, useValue: {} },
        { provide: ActivatedRoute, useValue: { snapshot: { params: {} } } },
      ],
      imports: [RequestComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RequestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('formatJson', () => {
    it('pretty-prints a JSON string with two spaces', () => {
      expect(RequestComponent.formatJson('{"a":1}')).toBe('{\n  "a": 1\n}');
    });

    it('pretty-prints an object, which is how headers arrive', () => {
      expect(RequestComponent.formatJson({ 'content-type': 'application/json' }))
        .toBe('{\n  "content-type": "application/json"\n}');
    });

    it('leaves anything that is not JSON exactly as it was', () => {
      expect(RequestComponent.formatJson('<html></html>')).toBe('<html></html>');
    });

    it('turns nothing into an empty string', () => {
      expect(RequestComponent.formatJson(null)).toBe('');
      expect(RequestComponent.formatJson(undefined)).toBe('');
    });
  });

  describe('the editor tabs', () => {
    it('starts on Body and switches', () => {
      expect(component.activeTab).toBe('Body');

      component.onSelectTab('Headers');

      expect(component.activeTab).toBe('Headers');
    });

    it('offers Format on the two JSON tabs only', () => {
      component.onSelectTab('Body');
      expect(component.canFormat).toBe(true);

      component.onSelectTab('Headers');
      expect(component.canFormat).toBe(true);

      component.onSelectTab('Code');
      expect(component.canFormat).toBe(false);
    });

    it('resets the tab on display, and nothing else', () => {
      const calls: string[] = [];
      jest.spyOn(component, 'onRevertResponse').mockImplementation(() => { calls.push('body'); });
      jest.spyOn(component, 'onRevertHeaders').mockImplementation(() => { calls.push('headers'); });
      jest.spyOn(component, 'onRevertCode').mockImplementation(() => { calls.push('code'); });

      component.onSelectTab('Body');
      component.onReset();
      component.onSelectTab('Headers');
      component.onReset();
      component.onSelectTab('Code');
      component.onReset();

      expect(calls).toEqual(['body', 'headers', 'code']);
    });
  });
});
