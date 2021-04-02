import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatTableModule } from '@angular/material/table';

import { CodeErrorsComponent } from './code-errors.component';

describe('CodeErrorsComponent', () => {
  let component: CodeErrorsComponent;
  let fixture: ComponentFixture<CodeErrorsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CodeErrorsComponent],
      imports: [MatTableModule],
      schemas: [NO_ERRORS_SCHEMA]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CodeErrorsComponent);
    component = fixture.componentInstance;
    component.errors = [];
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
