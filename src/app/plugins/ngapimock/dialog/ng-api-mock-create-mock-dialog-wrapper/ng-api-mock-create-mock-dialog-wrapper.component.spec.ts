import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NgApiMockCreateMockDialogWrapperComponent } from './ng-api-mock-create-mock-dialog-wrapper.component';

describe('NgApiMockCreateMockDialogWrapperComponent', () => {
  let component: NgApiMockCreateMockDialogWrapperComponent;
  let fixture: ComponentFixture<NgApiMockCreateMockDialogWrapperComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ NgApiMockCreateMockDialogWrapperComponent ]
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
