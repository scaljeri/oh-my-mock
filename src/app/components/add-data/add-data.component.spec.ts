import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';

import { AddDataComponent } from './add-data.component';

describe('AddDataComponent', () => {
  let component: AddDataComponent;
  let fixture: ComponentFixture<AddDataComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AddDataComponent],
      providers: [{ provide: MatDialogRef, useValue: {} }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AddDataComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
