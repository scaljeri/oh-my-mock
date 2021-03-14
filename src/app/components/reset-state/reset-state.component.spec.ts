import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { AppStateService } from '../../services/app-state.service';

import { ResetStateComponent } from './reset-state.component';

describe('ResetStateComponent', () => {
  let component: ResetStateComponent;
  let fixture: ComponentFixture<ResetStateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ResetStateComponent],
      providers: [
        { provide: AppStateService, useValue: {} },
        { provide: MatDialogRef, useValue: {} },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ResetStateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
