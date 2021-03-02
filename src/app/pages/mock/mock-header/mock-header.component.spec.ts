import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MockHeaderComponent } from './mock-header.component';

describe('MockHeaderComponent', () => {
  let component: MockHeaderComponent;
  let fixture: ComponentFixture<MockHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MockHeaderComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MockHeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
