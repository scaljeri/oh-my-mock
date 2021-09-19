import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScenarioDropdownComponent } from './scenario-dropdown.component';

describe('ScenarioDropdownComponent', () => {
  let component: ScenarioDropdownComponent;
  let fixture: ComponentFixture<ScenarioDropdownComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ScenarioDropdownComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ScenarioDropdownComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
