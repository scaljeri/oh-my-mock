import { CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';

import { NavListComponent } from './nav-list.component';
import { OhMyState } from '../../services/oh-my-store';

describe('NavListComponent', () => {
  let component: NavListComponent;
  let fixture: ComponentFixture<NavListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // The actions are a `mat-menu` now.
      imports: [MatMenuModule, NavListComponent],
      providers: [
        // `routerLink` in the template needs a router; the component used to
        // get one from the module graph and now carries its own imports.
        provideRouter([]),
        { provide: OhMyState, useValue: {} },
        { provide: MatDialog, useValue: {} },
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

  /**
   * Plainly listed, not behind a trigger. The drawer these sit in is already
   * something you opened on purpose; a menu inside it is a second button in
   * front of the same list.
   */
  it('lists the actions rather than hiding them behind a trigger', () => {
    expect(
      fixture.nativeElement.querySelectorAll('.oh-nav-menu__trigger')
    ).toHaveLength(0);
    expect(
      fixture.nativeElement.querySelectorAll('.oh-nav__item').length
    ).toBeGreaterThan(4);
  });

  /**
   * The drawer holds the only navigation there is — the pages that stand on
   * their own have nothing else on screen that goes anywhere — so a way back to
   * the request list has to be one of these.
   */
  it('offers a way back to the request list', () => {
    const home: HTMLAnchorElement | null = fixture.nativeElement.querySelector(
      '[x-test="nav-requests"]'
    );

    expect(home).toBeTruthy();
    expect(home?.getAttribute('href')).toBe('/');
  });
});
