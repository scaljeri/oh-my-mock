import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HotToastService } from '@ngxpert/hot-toast';

import { PresetComponent } from './preset.component';
import { OhMyStateService } from '../../services/state.service';
import { OhMyState } from '../../services/oh-my-store';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { IState } from '@shared/type';
import { StateUtils } from '@shared/utils/state';
import { BehaviorSubject } from 'rxjs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('PresetComponent', () => {
  let component: PresetComponent;
  let fixture: ComponentFixture<PresetComponent>;
  let stateSubject: BehaviorSubject<IState>;
  let upsertState: jest.Mock;

  beforeEach(async () => {
    stateSubject = new BehaviorSubject<IState>(
      StateUtils.init({ domain: 'localhost:8090' })
    );
    upsertState = jest.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [PresetComponent],
      providers: [
        { provide: HotToastService, useValue: {} },
        // `ngOnChanges` subscribes to this the moment a context arrives; an
        // empty stub made the component throw as soon as the spec stopped
        // rendering it context-less. A subject rather than `of(...)`, so the
        // specs below can see whether the component is still listening.
        {
          provide: OhMyStateService,
          useValue: {
            getState$: () => stateSubject.asObservable()
          }
        },
        { provide: OhMyState, useValue: { upsertState } },
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PresetComponent);
    component = fixture.componentInstance;
    // A context is required, not optional. Both call sites render this behind
    // an `@if (context)` and the component reads `this.context.preset`
    // unguarded in four places — a context-less preset is a state production
    // never reaches, and this spec used to construct one.
    fixture.componentRef.setInput('context', { domain: 'localhost:8090', preset: 'default' });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('lists the presets the state carries', () => {
    expect(component.options).toEqual(['Default']);
  });

  /**
   * The dropdown is rendered for real here — no `NO_ERRORS_SCHEMA` — because
   * `context` and `options` leave this component only as inputs on
   * `oh-my-autocomplete-dropdown`, and with the schema in place that tag is an
   * unknown element whose bindings go nowhere. A row count or a button lookup
   * inside it would then be looking at nothing at all.
   */
  describe('what the state stream puts on screen', () => {
    let domFixture: ComponentFixture<PresetComponent>;

    /** The labels the open autocomplete panel is currently offering. */
    const offeredOptions = (): (string | undefined)[] =>
      Array.from(document.querySelectorAll('mat-option')).map((el) =>
        el.textContent?.trim()
      );

    const stateWith = (preset: string, presets: Record<string, string>): IState =>
      ({
        ...StateUtils.init({ domain: 'localhost:8090' }),
        presets,
        context: { domain: 'localhost:8090', preset }
      } as unknown as IState);

    beforeEach(async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [PresetComponent, NoopAnimationsModule],
        providers: [
          { provide: HotToastService, useValue: { warning: jest.fn() } },
          {
            provide: OhMyStateService,
            useValue: { getState$: () => stateSubject.asObservable() }
          },
          { provide: OhMyState, useValue: { upsertState, newPreset: jest.fn() } }
        ]
      }).compileComponents();

      stateSubject.next(stateWith('p1', { p1: 'Default' }));

      domFixture = TestBed.createComponent(PresetComponent);
      domFixture.componentRef.setInput('context', {
        domain: 'localhost:8090',
        preset: 'p1'
      });
      domFixture.detectChanges();
    });

    /**
     * A preset created elsewhere — in another popup window, or by an import —
     * arrives on the state stream and has to turn up in the list.
     *
     * The selected preset and its label deliberately do not change here, only
     * the set of presets. That matters: when the emission also changes the
     * control's value, the forms machinery ends up marking this view anyway and
     * the list refreshes whether or not the component asked for it — an earlier
     * version of this spec did exactly that and passed with the `markForCheck`
     * taken out, proving nothing. Holding the selection still removes that
     * accident, and leaves `options` reaching the dropdown resting on the one
     * thing that is supposed to carry it.
     */
    it('offers a preset that appears while the list is open', () => {
      const input = domFixture.nativeElement.querySelector('input');

      // Opening the panel is a real listener, so this part needs no help.
      input.dispatchEvent(new Event('focusin'));
      input.dispatchEvent(new Event('focus'));
      domFixture.detectChanges();

      expect(offeredOptions()).toEqual(['Default']);

      // `getState$` delivers through the store, so this stands in for a
      // storage callback: no listener anywhere in the path. `options` is an
      // `@Input` on the equally-OnPush dropdown, and an input is only rewritten
      // when the parent's template is evaluated — which is what the mark is
      // for. Asserting `component.options` instead would pass either way.
      stateSubject.next(stateWith('p1', { p1: 'Default', p2: 'Extra' }));
      domFixture.detectChanges();

      expect(offeredOptions()).toEqual(['Default', 'Extra']);
    });
  });

  /**
   * Two subscriptions used to outlive the component: the control's
   * `valueChanges`, which was never put into the container `ngOnDestroy`
   * empties, and the state subscription, which `ngOnChanges` replaced per
   * context but nothing closed on destroy.
   */
  describe('on destroy', () => {
    it('lets go of the state stream', () => {
      expect(stateSubject.observed).toBe(true);

      fixture.destroy();

      expect(stateSubject.observed).toBe(false);
    });

    it('stops writing renames', () => {
      fixture.destroy();

      component.presetCtrl.setValue('Renamed');

      expect(upsertState).not.toHaveBeenCalled();
    });
  });
});
