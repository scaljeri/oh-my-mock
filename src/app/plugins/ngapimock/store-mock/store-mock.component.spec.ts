import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StoreMockComponent } from './store-mock.component';

describe('StoreMockComponent', () => {
  let component: StoreMockComponent;
  let fixture: ComponentFixture<StoreMockComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ StoreMockComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(StoreMockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
