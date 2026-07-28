import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { ShowErrorsComponent } from './show-errors.component';

/**
 * `errors` arrives through `MAT_DIALOG_DATA` rather than being assigned after
 * construction: it used to be `@Optional()` and untyped, so the spec could
 * build the component with nothing and set the field afterwards.
 */
describe('ShowErrorsComponent', () => {
  let component: ShowErrorsComponent;
  let fixture: ComponentFixture<ShowErrorsComponent>;

  function build(errors: unknown[]): void {
    TestBed.configureTestingModule({
      declarations: [ShowErrorsComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: MatDialogRef, useValue: { close: () => undefined } },
        { provide: MAT_DIALOG_DATA, useValue: errors }
      ]
    });

    fixture = TestBed.createComponent(ShowErrorsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  it('should create', () => {
    build([]);

    expect(component).toBeTruthy();
  });

  // `background/error-handler.ts` builds its payload from `...errors: unknown[]`,
  // so a rejection reason is as often an `Error` as a string. Splitting a
  // non-string used to throw and leave the dialog blank.
  it('renders an Error reason as its stack lines', () => {
    build([{ data: { errors: [new Error('boom')] } }]);

    // `IPacketPayload.data` is `unknown`, so this narrows rather than casts —
    // the shape the component builds is exactly what is being asserted.
    const { data } = component.errors[0];

    if (typeof data !== 'object' || data === null || !('errors' in data)) {
      throw new Error('the component did not build an `errors` array');
    }

    const lines = data.errors;

    if (!Array.isArray(lines)) {
      throw new Error('`errors` should be an array of line arrays');
    }

    expect(String(lines[0][0])).toContain('boom');
  });
});
