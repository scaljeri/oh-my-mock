import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatTableModule } from '@angular/material/table';
import { MatMenuModule } from '@angular/material/menu';

import { DataListComponent } from './data-list.component';
import { RouterTestingModule } from '@angular/router/testing';
import { AnimationBuilder } from '@angular/animations';
import { MatDialog } from '@angular/material/dialog';

describe('DataListComponent', () => {
  let component: DataListComponent;
  let fixture: ComponentFixture<DataListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DataListComponent],
      schemas: [NO_ERRORS_SCHEMA],
      imports: [MatMenuModule, RouterTestingModule.withRoutes([]), MatTableModule],
      providers: [AnimationBuilder, { provide: MatDialog, useValue: {} },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DataListComponent);
    component = fixture.componentInstance;
    component.state = { toggles: {}, aux: {} } as any;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
