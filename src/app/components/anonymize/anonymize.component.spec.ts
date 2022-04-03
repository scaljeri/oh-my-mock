import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';

import { AnonymizeComponent } from './anonymize.component';

describe('AnonymizeComponent', () => {
  let component: AnonymizeComponent;
  let fixture: ComponentFixture<AnonymizeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AnonymizeComponent],
      providers: [
        { provide: MatDialog, useValue: {} }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AnonymizeComponent);
    component = fixture.componentInstance;
    component.mock = {} as any;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
