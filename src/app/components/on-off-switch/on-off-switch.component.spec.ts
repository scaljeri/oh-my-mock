import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OnOffSwitchComponent } from './on-off-switch.component';

describe('OnOffSwitchComponent', () => {
  let component: OnOffSwitchComponent;
  let fixture: ComponentFixture<OnOffSwitchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ OnOffSwitchComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(OnOffSwitchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
