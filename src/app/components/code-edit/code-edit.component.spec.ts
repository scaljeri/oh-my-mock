import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { PrettyPrintPipe } from '../../pipes/pretty-print.pipe'

import { CodeEditComponent } from './code-edit.component';

describe('CodeEditComponent', () => {
  let component: CodeEditComponent;
  let fixture: ComponentFixture<CodeEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CodeEditComponent],
      providers: [
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
});
