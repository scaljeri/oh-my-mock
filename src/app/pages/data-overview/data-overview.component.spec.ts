import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { NgxsModule } from '@ngxs/store';
import { AppStateService } from 'src/app/services/app-state.service';

import { DataOverviewComponent } from './data-overview.component';

describe('DataOverviewComponent', () => {
  let component: DataOverviewComponent;
  let fixture: ComponentFixture<DataOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DataOverviewComponent],
      providers: [
        { provide: MatDialog, useValue: {} },
        { provide: AppStateService, useValue: {} }
      ],
      imports: [RouterTestingModule.withRoutes([]), NgxsModule.forRoot([])],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DataOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
