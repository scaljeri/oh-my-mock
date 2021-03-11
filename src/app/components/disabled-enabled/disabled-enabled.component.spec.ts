import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DisabledEnabledComponent } from './disabled-enabled.component';

describe('DisabledEnabledComponent', () => {
  let component: DisabledEnabledComponent;
  let fixture: ComponentFixture<DisabledEnabledComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DisabledEnabledComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DisabledEnabledComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
