import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { Subject } from 'rxjs';
import { AppStateService } from '../../services/app-state.service';
import { OhMyState } from '../../services/oh-my-store';
import { OhMyStateService } from '../../services/state.service';
import { PageDataListComponent } from './data-list.component';

describe('DataOverviewComponent', () => {
  let component: PageDataListComponent;
  let fixture: ComponentFixture<PageDataListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        { provide: MatDialog, useValue: {} },
        { provide: AppStateService, useValue: {} },
        { provide: OhMyStateService, useValue: { state$: new Subject(), requests$: new Subject() } },
        {
          provide: OhMyState,
          // The list reads the browser-global sort preference on init.
          useValue: { getStore: async () => ({}), updateStore: async () => ({}) }
        },
        { provide: Router, useValue: {} },
        { provide: ActivatedRoute, useValue: {} },
      ],
      imports: [RouterTestingModule.withRoutes([]), PageDataListComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PageDataListComponent);
    component = fixture.componentInstance;
    component.state = {} as any;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

/** Whatever the detail route renders; this spec only cares that it is there. */
@Component({ selector: 'oh-my-test-detail', template: 'detail' })
class TestDetailComponent {}

/**
 * The detail pane is driven by the child route rather than by a field, so
 * `hasDetail` only changes once the router has finished navigating — which is
 * after the click that asked for it has had its change-detection pass. These
 * run a real router for that reason: a stubbed `navigate` would decide the
 * timing this is about.
 *
 * No `NO_ERRORS_SCHEMA`: the pane is a real `<aside>` with a real
 * `<router-outlet>` inside it, and the schema would let the assertions below
 * pass against an element Angular had quietly stopped rendering.
 */
describe('PageDataListComponent, the routed detail pane', () => {
  let fixture: ComponentFixture<PageDataListComponent>;
  let component: PageDataListComponent;
  let router: Router;

  const detailPane = (): Element | null =>
    fixture.nativeElement.querySelector('[x-test="request-detail"]');
  const panesHaveDetail = (): boolean =>
    fixture.nativeElement
      .querySelector('.oh-panes')
      .classList.contains('has-detail');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([
          { path: 'request/:dataId', component: TestDetailComponent }
        ]),
        MatIconModule,
        PageDataListComponent
      ],
      providers: [
        { provide: MatDialog, useValue: {} },
        { provide: AppStateService, useValue: {} },
        {
          provide: OhMyStateService,
          useValue: { state$: new Subject(), requests$: new Subject() }
        },
        {
          provide: OhMyState,
          useValue: { getStore: async () => ({}), updateStore: async () => ({}) }
        }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(PageDataListComponent);
    component = fixture.componentInstance;
    // The list itself is behind `@if (state)` and is not what these assert;
    // leaving the state unset keeps the heavyweight child out of the fixture.
    fixture.detectChanges();
  });

  it('opens the detail pane once the navigation has resolved', async () => {
    expect(detailPane()).toBeNull();
    expect(panesHaveDetail()).toBe(false);

    // The real caller is the list's `(selectRow)` output. Going through it
    // would not change what is being tested: routing resolves a task later, so
    // whatever change detection that listener causes has already run against
    // the old `firstChild` by the time this becomes true.
    component.onDataSelect('abc');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(router.url).toBe('/request/abc');
    expect(detailPane()).not.toBeNull();
    expect(panesHaveDetail()).toBe(true);
  });

  it('closes the detail pane once the navigation back has resolved', async () => {
    component.onDataSelect('abc');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(detailPane()).not.toBeNull();

    component.onCloseDetail();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(detailPane()).toBeNull();
    expect(panesHaveDetail()).toBe(false);
  });
});
