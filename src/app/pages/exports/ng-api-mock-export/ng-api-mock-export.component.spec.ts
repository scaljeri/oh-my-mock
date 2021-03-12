import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NgApiMockExportComponent } from './ng-api-mock-export.component';

describe('NgApiMockExportComponent', () => {
  let component: NgApiMockExportComponent;
  let fixture: ComponentFixture<NgApiMockExportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [NgApiMockExportComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NgApiMockExportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
