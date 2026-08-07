import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { HotToastService } from '@ngxpert/hot-toast';
import { Subject } from 'rxjs';
import { NGX_MONACO_EDITOR_CONFIG } from 'ngx-monaco-editor-v2';
import { PrettyPrintPipe } from '../../pipes/pretty-print.pipe';
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

  /**
   * The editor is what a full-screen dialog replaces and hands back, so these
   * assert the rendered `.oh-editor` rather than `dialogIsOpen`. The flag was
   * always restored correctly; under Angular 22's default OnPush what stopped
   * happening is the render, and a test reading the field cannot tell the two
   * apart.
   */
  describe('the editor around a dialog', () => {
    let editorFixture: ComponentFixture<RequestComponent>;
    let dialogClosed: Subject<unknown>;

    const editor = (): Element | null =>
      editorFixture.nativeElement.querySelector('.oh-editor');

    const aResponse = (): any => ({
      id: 'm1',
      statusCode: 200,
      responseMock: '{}',
      headersMock: { 'content-type': 'application/json' },
      jsCode: ''
    });

    beforeEach(async () => {
      dialogClosed = new Subject<unknown>();

      TestBed.resetTestingModule();
      // No `NO_ERRORS_SCHEMA` here, unlike the suite above: `.oh-editor` only
      // means anything if the editors inside it are the real components, and
      // the schema would happily let this pass against a `<div>` full of
      // elements Angular had stopped recognising.
      await TestBed.configureTestingModule({
        providers: [
          {
            provide: MatDialog,
            useValue: { open: () => ({ afterClosed: () => dialogClosed }) }
          },
          { provide: Router, useValue: {} },
          { provide: OhMyState, useValue: { upsertResponse: jest.fn() } },
          { provide: OhMyStateService, useValue: { response$: new Subject() } },
          {
            provide: StorageService,
            // `m2` is a pick that outlived its record — the response was
            // deleted while the id stayed on the request. Storage answers
            // nothing for it, which is the case the early return handles.
            useValue: {
              get: jest
                .fn()
                .mockImplementation(async (id: string) =>
                  id === 'm1' ? aResponse() : undefined
                )
            }
          },
          { provide: HotToastService, useValue: { error: jest.fn() } },
          { provide: ActivatedRoute, useValue: { snapshot: { params: {} } } },
          { provide: NGX_MONACO_EDITOR_CONFIG, useValue: {} },
          { provide: PrettyPrintPipe, useValue: { transform: (v: unknown) => v } }
        ],
        imports: [RequestComponent]
      }).compileComponents();

      editorFixture = TestBed.createComponent(RequestComponent);
      // A request with a response actually being served: enabled for the
      // preset, one picked, and that one still present. `activeMockId` needs
      // all three, and without them `ngOnChanges` clears `response` and the
      // whole `@if (response)` block — editor included — never renders.
      editorFixture.componentRef.setInput('request', {
        id: 'r1',
        url: '/api',
        method: 'GET',
        requestType: 'XHR',
        mocks: { m1: { id: 'm1', statusCode: 200 } },
        selected: { default: 'm1' },
        enabled: { default: true }
      });
      editorFixture.componentRef.setInput('context', {
        domain: 'test.dev',
        preset: 'default'
      });
      editorFixture.detectChanges();
      // `ngOnChanges` reads the response out of storage, so the pane is only
      // fully rendered once that promise has settled.
      await editorFixture.whenStable();
      editorFixture.detectChanges();
    });

    /**
     * Clicks one of the tab actions by its label.
     *
     * The click goes through the DOM rather than calling the handler, because
     * the two are not equivalent under OnPush and the difference is the whole
     * subject here: a real `(click)` marks the view dirty, so the editor
     * disappears on the way in without any help. Calling `onAnonymize()`
     * straight on the instance marks nothing, and the test would then be
     * measuring its own shortcut rather than the component.
     */
    const clickAction = (label: string): void => {
      const button = Array.from(
        editorFixture.nativeElement.querySelectorAll('.oh-tabs__action')
      ).find((el) => (el as HTMLElement).textContent?.trim() === label);

      expect(button).toBeTruthy();
      (button as HTMLElement).click();
      editorFixture.detectChanges();
    };

    it('brings the editor back when the anonymize dialog closes', () => {
      expect(editor()).not.toBeNull();

      clickAction('Anonymise');
      expect(editor()).toBeNull();

      // The close arrives on the dialog's own observable, long after that
      // click was checked, so only the component's own mark can put the
      // editor back.
      dialogClosed.next(undefined);
      editorFixture.detectChanges();

      expect(editor()).not.toBeNull();
    });

    it('clears the pane when the picked response is no longer stored', async () => {
      expect(editor()).not.toBeNull();

      // The same request, now pointing at a response storage cannot produce.
      editorFixture.componentRef.setInput('request', {
        id: 'r1',
        url: '/api',
        method: 'GET',
        requestType: 'XHR',
        mocks: { m2: { id: 'm2', statusCode: 200 } },
        selected: { default: 'm2' },
        enabled: { default: true }
      });
      editorFixture.detectChanges();
      // The lookup is awaited, so `response` only becomes undefined a microtask
      // after the input change has had its own render — which is exactly why
      // that render cannot be the one that clears the pane.
      await editorFixture.whenStable();
      editorFixture.detectChanges();

      expect(editor()).toBeNull();
      expect(
        editorFixture.nativeElement.querySelector('oh-my-mock-details')
      ).toBeNull();
    });

    it('brings the editor back when the full-screen editor closes', () => {
      expect(editor()).not.toBeNull();

      clickAction('Expand');
      expect(editor()).toBeNull();

      dialogClosed.next(undefined);
      editorFixture.detectChanges();

      expect(editor()).not.toBeNull();
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
