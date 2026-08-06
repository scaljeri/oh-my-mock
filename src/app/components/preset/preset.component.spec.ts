import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HotToastService } from '@ngxpert/hot-toast';

import { PresetComponent } from './preset.component';
import { OhMyStateService } from '../../services/state.service';
import { OhMyState } from '../../services/oh-my-store';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { IState } from '@shared/type';
import { StateUtils } from '@shared/utils/state';
import { BehaviorSubject } from 'rxjs';

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
