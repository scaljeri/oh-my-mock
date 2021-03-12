import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';

import { DisabledEnabledComponent } from './disabled-enabled.component';

describe('DisabledEnabledComponent', () => {
  let component: DisabledEnabledComponent;
  let fixture: ComponentFixture<DisabledEnabledComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DisabledEnabledComponent],
      providers: [{ provide: MatDialogRef, useValue: {} }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DisabledEnabledComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
