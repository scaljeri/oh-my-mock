import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { NgxsModule } from '@ngxs/store';

import { MockComponent } from './mock.component';

describe('MockComponent', () => {
  let component: MockComponent;
  let fixture: ComponentFixture<MockComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MockComponent],
      providers: [
        { provide: MatDialog, useValue: {} },
        { provide: Router, useValue: {} },
        { provide: ActivatedRoute, useValue: { snapshot: { params: {} } } },
      ],
      imports: [NgxsModule.forRoot([])],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
