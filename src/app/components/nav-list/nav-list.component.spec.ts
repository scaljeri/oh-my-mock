import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { AppStateService } from '../../services/app-state.service';

import { NavListComponent } from './nav-list.component';

describe('NavListComponent', () => {
  let component: NavListComponent;
  let fixture: ComponentFixture<NavListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [NavListComponent],
      providers: [
        { provide: AppStateService, useValue: {} },
        { provide: MatDialog, useValue: {} },
        { provide: Router, useValue: {} },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NavListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
