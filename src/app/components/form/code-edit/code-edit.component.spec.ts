import { NO_ERRORS_SCHEMA } from '@angular/core';
import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick
} from '@angular/core/testing';
import { NGX_MONACO_EDITOR_CONFIG } from 'ngx-monaco-editor-v2';
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
