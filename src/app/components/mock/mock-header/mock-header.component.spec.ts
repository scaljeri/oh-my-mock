import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';

import { MockHeaderComponent } from './mock-header.component';

describe('MockHeaderComponent', () => {
  let component: MockHeaderComponent;
  let fixture: ComponentFixture<MockHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MockHeaderComponent],
      providers: [{ provide: MatDialog, useValue: {} }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MockHeaderComponent);
    component = fixture.componentInstance;
    component.data = {} as any;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
