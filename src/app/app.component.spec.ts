import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { IState } from '@shared/type';
import { AppComponent } from './app.component';
import { initializeApp } from './app.initialize';
import { AppStateService } from './services/app-state.service';
import { ContentService } from './services/content.service';
import { OhMyState } from './services/oh-my-store';
import { OhMyStateService } from './services/state.service';
import { WebWorkerService } from './services/web-worker.service';
import { IPacketPayload } from '@shared/packet-type';

// The real `initializeApp` reads query params and talks to `chrome.storage`;
// the shell's own behaviour — what this suite is about — starts after it
// resolves.
jest.mock('./app.initialize', () => ({
  initializeApp: jest.fn().mockResolvedValue(undefined)
}));

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let component: AppComponent;
  let state$: Subject<IState | null>;
  let errors$: Subject<IPacketPayload>;
  let connection$: Subject<boolean>;
  let updateAux: jest.Mock;
  let deactivate: jest.Mock;

  /** A state as `state$` delivers it, narrowed to what the shell reads. */
  const aState = (appActive: boolean): IState =>
    ({
      domain: 'example.com',
      version: '7.7.7',
      aux: { appActive },
      context: { domain: 'example.com', preset: 'default' }
    } as unknown as IState);

  beforeEach(async () => {
    state$ = new Subject<IState | null>();
    errors$ = new Subject<IPacketPayload>();
    connection$ = new Subject<boolean>();
    updateAux = jest.fn();
    deactivate = jest.fn();

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: AppStateService, useValue: { errors$ } },
        { provide: OhMyState, useValue: { updateAux } },
        { provide: OhMyStateService, useValue: { state$ } },
        {
          provide: ContentService,
          useValue: { pingPong: () => connection$, deactivate }
        },
        { provide: WebWorkerService, useValue: { init: jest.fn() } },
        { provide: Router, useValue: { navigate: jest.fn().mockResolvedValue(true) } },
        { provide: ActivatedRoute, useValue: {} },
        { provide: MatDialog, useValue: {} }
      ]
    })
      // The shell's children (sidebar, tab nav, router outlet, …) each pull in
      // services of their own; they have suites of their own too. Stripping the
      // imports leaves their tags as inert unknown elements.
      .overrideComponent(AppComponent, {
        set: { imports: [], schemas: [NO_ERRORS_SCHEMA] }
      })
      .compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    // First change detection runs `ngAfterViewInit`; the subscriptions inside
    // it are only registered once the (mocked) `initializeApp` has resolved.
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('creates the app and renders the shell', () => {
    expect(component).toBeTruthy();
    expect(initializeApp).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.oh-shell')).toBeTruthy();
  });

  it('stays in the initializing state until a state arrives', () => {
    expect(component.isInitializing).toBe(true);

    state$.next(null);

    expect(component.isInitializing).toBe(true);
  });

  it('renders the loaded state: domain in the header, toggle on', () => {
    state$.next(aState(true));

    expect(component.isInitializing).toBe(false);
    expect(component.enabled).toBe(true);
    expect(component.domain).toBe('example.com');
    expect(
      fixture.nativeElement.querySelector('.oh-header__domain')?.textContent
    ).toContain('example.com');
  });

  it('shows the disabled prompt once for an inactive domain', () => {
    state$.next(aState(false));

    expect(component.enabled).toBe(false);
    expect(component.showDisabled).toBe(1);

    // Dismissed is remembered: the next state emission must not re-raise it.
    component.onDismissDisabled();
    state$.next(aState(false));

    expect(component.showDisabled).toBe(0);
  });

  it('writes the toggle through the store, to this domain and preset', () => {
    state$.next(aState(false));

    component.onEnableChange(true);

    expect(updateAux).toHaveBeenCalledWith(
      { appActive: true },
      expect.objectContaining({ domain: 'example.com', preset: 'default' })
    );
  });

  it('reports the content-script connection verdict, both ways', () => {
    expect(component.connectionFailed).toBeNull();

    connection$.next(false);
    expect(component.connectionFailed).toBe(true);

    connection$.next(true);
    expect(component.connectionFailed).toBe(false);
  });

  it('tells the content script when it goes away', () => {
    fixture.destroy();

    expect(deactivate).toHaveBeenCalled();
  });
});
