import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';

import { NavListComponent } from './nav-list.component';
import { OhMyState } from '../../services/oh-my-store';
import { StorageService } from '../../services/storage.service';
import { OhMyStateService } from '../../services/state.service';

describe('NavListComponent', () => {
  let component: NavListComponent;
  let fixture: ComponentFixture<NavListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [NavListComponent],
      providers: [
        { provide: OhMyState, useValue: {} },
        { provide: OhMyStateService, useValue: {} },
        { provide: StorageService, useValue: {} },
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
