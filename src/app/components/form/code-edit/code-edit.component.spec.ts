import { ChangeDetectorRef, NO_ERRORS_SCHEMA } from '@angular/core';
import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick
} from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  DiffEditorComponent,
  NGX_MONACO_EDITOR_CONFIG
} from 'ngx-monaco-editor-v2';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { PrettyPrintPipe } from '../../../pipes/pretty-print.pipe'

import { CodeEditComponent } from './code-edit.component';

describe('CodeEditComponent', () => {
  let component: CodeEditComponent;
  let fixture: ComponentFixture<CodeEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CodeEditComponent],
      providers: [
        // The editor's own config token. It comes from `provideMonacoEditor()`
        // at bootstrap in the real app; standalone components render their
        // real children, so `EditorComponent` is instantiated here too —
        // `NO_ERRORS_SCHEMA` used to make it an ignored unknown element.
        { provide: NGX_MONACO_EDITOR_CONFIG, useValue: {} },
        { provide: MatDialogRef, useValue: {} },
        { provide: MAT_DIALOG_DATA, useValue: {} },
        { provide: PrettyPrintPipe, useValue: { transform: () => { } } },
        // `the monaco poll` below constructs the component bare, outside any
        // view, where the real `ChangeDetectorRef` does not exist. Those specs
        // are about the timer and never render, so a stub is all they need —
        // the specs that do assert rendering use a fixture and get the real
        // one.
        {
          provide: ChangeDetectorRef,
          useValue: { markForCheck: () => { }, detectChanges: () => { } }
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CodeEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  /**
   * Everything after `await this.checkMonacoLoaded()` in `ngOnInit` runs as a
   * promise continuation, outside any listener, and rewrites three
   * template-bound fields. Under Angular 22's default OnPush nothing marks the
   * view for it.
   *
   * These assert what the diff editor was actually handed rather than the
   * component's own fields. Monaco does not run under jsdom, so `[options]`
   * and the two models have no projection into the DOM to look at — but an
   * `@Input` is only rewritten while the parent's template is being evaluated,
   * so reading one still distinguishes "the view was checked" from "the field
   * changed", which is the whole distinction at issue. Reading
   * `component.modifiedModel` would not.
   */
  describe('the fields written once monaco has loaded', () => {
    let diffFixture: ComponentFixture<CodeEditComponent>;
    /** Resolved by the test to stand in for monaco finishing its load. */
    let monacoLoaded: () => void;

    const diffEditor = (): DiffEditorComponent =>
      diffFixture.debugElement.query(By.directive(DiffEditorComponent))
        .componentInstance;

    beforeEach(() => {
      // The fixture the outer `beforeEach` builds is still polling for monaco
      // every 100ms, and `whenStable` below would never resolve while that
      // interval is in the queue. `ngOnDestroy` is what ends the poll, so
      // retiring the component that is not under test here is enough.
      fixture.destroy();

      // The load is a promise the test resolves rather than the real 100ms
      // poll. Not for speed: the poll registers its interval through the
      // fixture's `NgZone`, which is created before any `fakeAsync` zone the
      // test could set up, so `tick` never reaches it. Handing `ngOnInit` a
      // promise puts the moment monaco "arrives" under the test's control and
      // leaves nothing waiting on a clock.
      const loaded = new Promise<void>((resolve) => {
        monacoLoaded = resolve;
      });

      jest
        .spyOn(CodeEditComponent.prototype, 'checkMonacoLoaded')
        .mockReturnValue(loaded);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('hands the diff editor the code edited while monaco was still loading', async () => {
      diffFixture = TestBed.createComponent(CodeEditComponent);
      // `base` present puts the component in its diff mode, which is the one
      // that renders the two models. It also leaves `editorCtrl` unbound —
      // the `[formControl]` lives on the plain editor in the other branch —
      // so setting the control below pokes no forms machinery that might mark
      // this view as a side effect and mask what is being tested.
      diffFixture.componentRef.setInput('base', 'original');
      diffFixture.detectChanges();

      expect(diffEditor().modifiedModel().code).toBe('');

      // Typed while the loader was still going, so the continuation below is
      // the first thing to see it. Nothing in this path is a listener.
      diffFixture.componentInstance.editorCtrl.setValue('edited');

      monacoLoaded();
      await diffFixture.whenStable();
      diffFixture.detectChanges();

      expect(diffEditor().modifiedModel().code).toBe('edited');
      expect(diffEditor().originalModel().code).toBe('original');
    });
  });

  /**
   * `checkMonacoLoaded` used to poll every 100ms with no way to stop: not on
   * destroy, not ever if the loader had failed — a timer per editor, for the
   * life of the popup. These specs construct the component bare so the poll
   * runs on `fakeAsync`'s clock, and `fakeAsync` itself fails a test that
   * leaves a periodic timer in the queue.
   */
  describe('the monaco poll', () => {
    const createBare = (): CodeEditComponent =>
      TestBed.runInInjectionContext(() => new CodeEditComponent());

    it('ends the poll on destroy', fakeAsync(() => {
      const bare = createBare();

      bare.checkMonacoLoaded();
      tick(300);
      bare.ngOnDestroy();
      tick(300);
    }));

    it('gives up once the deadline passes', fakeAsync(() => {
      const bare = createBare();
      let settled = false;

      bare.checkMonacoLoaded().then(() => (settled = true));
      tick(21_000);

      expect(settled).toBe(true);
    }));
  });
});
