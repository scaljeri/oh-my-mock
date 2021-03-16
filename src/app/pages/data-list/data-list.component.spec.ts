import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { RouterTestingModule } from '@angular/router/testing';
import { NgxsModule } from '@ngxs/store';
import { AppStateService } from '../../services/app-state.service';
import { PageDataListComponent } from './data-list.component';

describe('DataOverviewComponent', () => {
  let component: PageDataListComponent;
  let fixture: ComponentFixture<PageDataListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PageDataListComponent],
      providers: [
        { provide: MatDialog, useValue: {} },
        { provide: AppStateService, useValue: {} }
      ],
      imports: [RouterTestingModule.withRoutes([]), NgxsModule.forRoot([])],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PageDataListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
