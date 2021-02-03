import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UrlsOverviewComponent } from './urls-overview.component';

describe('UrlsOverviewComponent', () => {
  let component: UrlsOverviewComponent;
  let fixture: ComponentFixture<UrlsOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UrlsOverviewComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(UrlsOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
