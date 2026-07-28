import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MockUtils } from '@shared/utils/mock';

import { AnonymizeComponent } from './anonymize.component';

/**
 * The dialog dependencies are provided rather than assigned after the fact.
 *
 * `mock` and `dialogRef` used to be `@Optional()`, so the spec could build the
 * component with neither and set `component.mock` afterwards. They are injected
 * at construction now — which is what production does, since this component is
 * only ever reached through `dialog.open(AnonymizeComponent, { data })`.
 */
describe('AnonymizeComponent', () => {
  let component: AnonymizeComponent;
  let fixture: ComponentFixture<AnonymizeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnonymizeComponent],
      providers: [
        { provide: MatDialog, useValue: {} },
        { provide: MatDialogRef, useValue: { close: () => undefined } },
        { provide: MAT_DIALOG_DATA, useValue: MockUtils.init() }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AnonymizeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('seeds the rule list with an empty row to type into', () => {
    expect(component.rules).toEqual([{ type: null, path: '' }]);
  });
});
