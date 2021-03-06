import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HeaderOverviewComponent } from './header-overview.component';

describe('HeaderOverviewComponent', () => {
  let component: HeaderOverviewComponent;
  let fixture: ComponentFixture<HeaderOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ HeaderOverviewComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(HeaderOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
