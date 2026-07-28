import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
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
      declarations: [DialogCodeEditorComponent],
      providers: [
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
