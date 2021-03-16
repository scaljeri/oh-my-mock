import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { HeaderButtonComponent } from './header-button.component';

describe('HeaderButtonComponent', () => {
  let component: HeaderButtonComponent;
  let fixture: ComponentFixture<HeaderButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [HeaderButtonComponent],
      providers: [{ provide: Location, useValue: {} }],
      imports: [RouterTestingModule.withRoutes([])],
      schemas: [NO_ERRORS_SCHEMA]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(HeaderButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
