import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HotToastService } from '@ngxpert/hot-toast';

import { PresetComponent } from './preset.component';
import { OhMyStateService } from '../../services/state.service';
import { OhMyState } from '../../services/oh-my-store';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';

describe('PresetComponent', () => {
  let component: PresetComponent;
  let fixture: ComponentFixture<PresetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PresetComponent],
      providers: [
        { provide: HotToastService, useValue: {} },
        // `ngOnChanges` subscribes to this the moment a context arrives; an
        // empty stub made the component throw as soon as the spec stopped
        // rendering it context-less.
        {
          provide: OhMyStateService,
          useValue: {
            getState$: () => of({
              domain: 'localhost:8090',
              context: { domain: 'localhost:8090', preset: 'default' },
              presets: { default: 'Default' }
            })
          }
        },
        { provide: OhMyState, useValue: {} },
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
});
