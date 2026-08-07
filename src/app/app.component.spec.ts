import {
  ChangeDetectorRef,
  EnvironmentInjector,
  NO_ERRORS_SCHEMA,
  runInInjectionContext
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgClass } from '@angular/common';
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
  /** Emits when the errors dialog is dismissed — see `the errors button`. */
  let errorsDialogClosed: Subject<void>;

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
    errorsDialogClosed = new Subject<void>();

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
        {
          provide: MatDialog,
          useValue: { open: () => ({ afterClosed: () => errorsDialogClosed }) }
        }
      ]
    })
      // The shell's children (sidebar, tab nav, router outlet, …) each pull in
      // services of their own; they have suites of their own too. Stripping the
      // imports leaves their tags as inert unknown elements.
      // `NgClass` is kept: it is a directive with no dependencies of its own,
      // and without it `[ngClass]` is not a binding at all but an unknown
      // property that `NO_ERRORS_SCHEMA` then silences — so `is-blurred` could
      // never appear and any assertion about it would be measuring the test
      // setup rather than the shell.
      .overrideComponent(AppComponent, {
        set: { imports: [NgClass], schemas: [NO_ERRORS_SCHEMA] }
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

  /**
   * `.oh-main__content` and `.oh-shell` are a `<section>` and a `<div>` in the
   * shell's own template, so `NO_ERRORS_SCHEMA` has nothing to do with either —
   * only the child components this suite strips are affected by it, and none of
   * them is being asserted on here.
   */
  describe('losing the state again', () => {
    const content = (): Element | null =>
      fixture.nativeElement.querySelector('.oh-main__content');
    const shellIsBlurred = (): boolean =>
      fixture.nativeElement
        .querySelector('.oh-shell')
        .classList.contains('is-blurred');

    it('goes back to the initializing state on screen, not just in the field', () => {
      state$.next(aState(true));
      expect(content()).not.toBeNull();
      expect(shellIsBlurred()).toBe(false);

      // The `if (!state)` branch is the one way out of that subscriber that
      // never reaches its closing `detectChanges()`, and the subscription is
      // registered after an `await` so no listener covers it either. The field
      // flipped even before the fix — what did not was the DOM, which kept
      // offering the whole page over a state that had gone away.
      state$.next(null);
      TestBed.tick();

      expect(content()).toBeNull();
      expect(shellIsBlurred()).toBe(true);
    });
  });

  /**
   * The button is a plain `<button>` in the shell's own template, so the
   * `NO_ERRORS_SCHEMA` above cannot swallow it and these assertions cannot pass
   * against nothing — the schema only silences the child *components* whose
   * imports this suite strips, and none of them is involved here.
   */
  describe('the errors button', () => {
    const errorsButton = (): Element | null =>
      fixture.nativeElement.querySelector('[x-test="show-errors"]');

    it('appears when an error arrives', () => {
      expect(errorsButton()).toBeNull();

      errors$.next({} as IPacketPayload);

      expect(errorsButton()).not.toBeNull();
    });

    it('goes away once the errors dialog has been dismissed', () => {
      errors$.next({} as IPacketPayload);
      expect(errorsButton()).not.toBeNull();

      component.onErrors();
      // The close arrives on the dialog's own observable, which is the whole
      // point: the `(click)` that opened it was checked long ago, so only the
      // component's own `markForCheck` can get the emptied list on screen.
      // Asserting `component.errors` instead would pass either way — the list
      // is cleared regardless; it is the DOM that used to keep the button.
      errorsDialogClosed.next();
      // `TestBed.tick()` runs the same traversal the running app does, so an
      // unmarked OnPush view is skipped exactly as it would be in the popup.
      // `fixture.detectChanges()` would do here too — it refreshes the *host*
      // view, and descending into this component still respects its dirty flag
      // — but `tick()` says what is meant without relying on that detail.
      TestBed.tick();

      expect(errorsButton()).toBeNull();
    });
  });
});
/**
 * The component is constructed directly rather than through a fixture: these
 * specs exercise the window-level key handlers, and rendering the shell would
 * drag in every child of the layout for no extra coverage.
 */
describe('AppComponent, constructed directly', () => {
  let component: AppComponent;
  let updateAux: jest.Mock;

  beforeEach(() => {
    updateAux = jest.fn().mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      providers: [
        { provide: AppStateService, useValue: {} },
        { provide: OhMyState, useValue: { updateAux } },
        { provide: OhMyStateService, useValue: {} },
        { provide: ContentService, useValue: {} },
        { provide: WebWorkerService, useValue: {} },
        { provide: Router, useValue: {} },
        { provide: ActivatedRoute, useValue: {} },
        { provide: MatDialog, useValue: {} },
        { provide: ChangeDetectorRef, useValue: { detectChanges: () => {} } }
      ]
    });

    component = runInInjectionContext(
      TestBed.inject(EnvironmentInjector),
      () => new AppComponent()
    );
    component.context = { domain: 'localhost:8090', preset: 'default' };
  });

  /**
   * Enter is a shortcut for "enable mocking" — from the page, not from a
   * control. The handler used to fire unguarded, so pressing Enter to confirm
   * the filter box, the url editor or a preset rename force-enabled mocking
   * for the whole domain as a side effect.
   */
  describe('the Enter shortcut', () => {
    const focus = (el: HTMLElement) => {
      document.body.appendChild(el);
      el.focus();

      return el;
    };

    afterEach(() => {
      (document.activeElement as HTMLElement | null)?.blur?.();
      document.body
        .querySelectorAll('input, textarea, button, [contenteditable]')
        .forEach((el) => el.remove());
    });

    it('enables mocking when nothing is being edited', () => {
      component.onEnable();

      expect(updateAux).toHaveBeenCalledWith(
        { appActive: true },
        component.context
      );
    });

    it('does nothing while typing in an input', () => {
      focus(document.createElement('input'));

      component.onEnable();

      expect(updateAux).not.toHaveBeenCalled();
    });

    it('does nothing while typing in a textarea', () => {
      focus(document.createElement('textarea'));

      component.onEnable();

      expect(updateAux).not.toHaveBeenCalled();
    });

    it('does nothing while a button has the focus — Enter is its click', () => {
      focus(document.createElement('button'));

      component.onEnable();

      expect(updateAux).not.toHaveBeenCalled();
    });

    it('does nothing while editing contenteditable content', () => {
      const div = document.createElement('div');

      div.setAttribute('contenteditable', 'true');
      div.tabIndex = -1;
      focus(div);

      component.onEnable();

      expect(updateAux).not.toHaveBeenCalled();
    });
});
});
