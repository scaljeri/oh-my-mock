import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HotToastService } from '@ngneat/hot-toast';

import { PresetComponent } from './preset.component';
import { OhMyStateService } from '../../services/state.service';
import { OhMyState } from '../../services/oh-my-store';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('PresetComponent', () => {
  let component: PresetComponent;
  let fixture: ComponentFixture<PresetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PresetComponent],
      providers: [
        { provide: HotToastService, useValue: {} },
        { provide: OhMyStateService, useValue: {} },
        { provide: OhMyState, useValue: {} },
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PresetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
