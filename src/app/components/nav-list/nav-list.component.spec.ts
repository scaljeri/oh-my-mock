import { CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { Router } from '@angular/router';

import { NavListComponent } from './nav-list.component';
import { OhMyState } from '../../services/oh-my-store';

describe('NavListComponent', () => {
  let component: NavListComponent;
  let fixture: ComponentFixture<NavListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [NavListComponent],
      // The actions are a `mat-menu` now.
      imports: [MatMenuModule],
      providers: [
        { provide: OhMyState, useValue: {} },
        { provide: MatDialog, useValue: {} },
        { provide: Router, useValue: {} },
      ],
      schemas: [NO_ERRORS_SCHEMA, CUSTOM_ELEMENTS_SCHEMA]
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

  it('is a single menu trigger, not a list of buttons', () => {
    const triggers = fixture.nativeElement.querySelectorAll('.oh-nav-menu__trigger');

    expect(triggers.length).toBe(1);
  });
});
