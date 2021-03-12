import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgApimockSettingsService } from '../ng-apimock-settings.service';

import { NgApimockSettingsComponent } from './ng-apimock-settings.component';

describe('NgApimockSettingsComponent', () => {
  let component: NgApimockSettingsComponent;
  let fixture: ComponentFixture<NgApimockSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [NgApimockSettingsComponent],
      providers: [
        {
          provide: NgApimockSettingsService,
          useValue: { getSettings: () => new Promise(() => {}) }
        },
        { provide: MatSnackBar, useValue: {} }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NgApimockSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
