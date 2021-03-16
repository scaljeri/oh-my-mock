import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { NgApiMockCreateMockDialogWrapperComponent } from './ng-api-mock-create-mock-dialog-wrapper.component';

describe('NgApiMockCreateMockDialogWrapperComponent', () => {
  let component: NgApiMockCreateMockDialogWrapperComponent;
  let fixture: ComponentFixture<NgApiMockCreateMockDialogWrapperComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [NgApiMockCreateMockDialogWrapperComponent],
      imports: [MatDialogModule],
      providers: [{ provide: MAT_DIALOG_DATA, useValue: {} }],
      schemas: [NO_ERRORS_SCHEMA]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NgApiMockCreateMockDialogWrapperComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
