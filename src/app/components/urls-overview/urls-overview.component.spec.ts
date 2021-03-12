import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgxsModule } from '@ngxs/store';

import { UrlsOverviewComponent } from './urls-overview.component';

describe('UrlsOverviewComponent', () => {
  let component: UrlsOverviewComponent;
  let fixture: ComponentFixture<UrlsOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [UrlsOverviewComponent],
      schemas: [NO_ERRORS_SCHEMA],
      imports: [NgxsModule.forRoot([])],
    }).compileComponents();
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
