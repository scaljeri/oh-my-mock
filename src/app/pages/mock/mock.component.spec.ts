import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { NgxsModule } from '@ngxs/store';

import { PageMockComponent } from './mock.component';

describe('MockComponent', () => {
  let component: PageMockComponent;
  let fixture: ComponentFixture<PageMockComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PageMockComponent ],
      imports: [RouterTestingModule.withRoutes([]), NgxsModule.forRoot([])],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PageMockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
