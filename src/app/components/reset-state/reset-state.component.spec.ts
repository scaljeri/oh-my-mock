import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResetStateComponent } from './reset-state.component';

describe('ResetStateComponent', () => {
  let component: ResetStateComponent;
  let fixture: ComponentFixture<ResetStateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ResetStateComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ResetStateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
