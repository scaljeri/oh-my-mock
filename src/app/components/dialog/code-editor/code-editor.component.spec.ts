import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NGX_MONACO_EDITOR_CONFIG } from 'ngx-monaco-editor-v2';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { IOhMyCodeEditOptions } from '../../form/code-edit/code-edit';

import { DialogCodeEditorComponent } from './code-editor.component';

/**
 * The dialog dependencies are provided, not left absent: they used to be
 * `@Optional()` and are injected at construction now, which is what production
 * does — this is only ever opened through `dialog.open(…, { data })`.
 */
describe('CodeEditorComponent', () => {
  let component: DialogCodeEditorComponent;
  let fixture: ComponentFixture<DialogCodeEditorComponent>;

  const data: IOhMyCodeEditOptions = { code: '{ "a": 1 }', base: '{}', type: 'json' };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DialogCodeEditorComponent],
      providers: [
        // The editor's own config token. It comes from `provideMonacoEditor()`
        // at bootstrap in the real app; standalone components render their
        // real children, so `EditorComponent` is instantiated here too —
        // `NO_ERRORS_SCHEMA` used to make it an ignored unknown element.
        { provide: NGX_MONACO_EDITOR_CONFIG, useValue: {} },
        { provide: MatDialogRef, useValue: { close: () => undefined } },
        { provide: MAT_DIALOG_DATA, useValue: data }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DialogCodeEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('opens on the code it was handed', () => {
    expect(component.ctrl.value).toBe(data.code);
    expect(component.base).toBe(data.base);
  });
});
