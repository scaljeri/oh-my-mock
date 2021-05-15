import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MockLabelComponent } from './mock-label.component';

describe('MockLabelComponent', () => {
  let component: MockLabelComponent;
  let fixture: ComponentFixture<MockLabelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MockLabelComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MockLabelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
