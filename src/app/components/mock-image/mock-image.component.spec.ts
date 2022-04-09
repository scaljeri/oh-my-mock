import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MockImageComponent } from './mock-image.component';

describe('MockImageComponent', () => {
  let component: MockImageComponent;
  let fixture: ComponentFixture<MockImageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MockImageComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MockImageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
