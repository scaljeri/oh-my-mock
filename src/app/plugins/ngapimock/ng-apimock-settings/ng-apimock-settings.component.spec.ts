import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
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
          useValue: { getSettings: () => new Promise(() => {}) },
        },
        { provide: MatSnackBar, useValue: {} },
      ],
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
