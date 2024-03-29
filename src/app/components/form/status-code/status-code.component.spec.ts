import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StatusCodeComponent } from './status-code.component';

describe('StatusCodeComponent', () => {
  let component: StatusCodeComponent;
  let fixture: ComponentFixture<StatusCodeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StatusCodeComponent],
      schemas: [NO_ERRORS_SCHEMA]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(StatusCodeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
