import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { Subject } from 'rxjs';
import { AppStateService } from '../../services/app-state.service';
import { OhMyState } from '../../services/oh-my-store';
import { OhMyStateService } from '../../services/state.service';
import { PageDataListComponent } from './data-list.component';

describe('DataOverviewComponent', () => {
  let component: PageDataListComponent;
  let fixture: ComponentFixture<PageDataListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        { provide: MatDialog, useValue: {} },
        { provide: AppStateService, useValue: {} },
        { provide: OhMyStateService, useValue: { state$: new Subject(), requests$: new Subject() } },
        {
          provide: OhMyState,
          // The list reads the browser-global sort preference on init.
          useValue: { getStore: async () => ({}), updateStore: async () => ({}) }
        },
        { provide: Router, useValue: {} },
        { provide: ActivatedRoute, useValue: {} },
      ],
      imports: [RouterTestingModule.withRoutes([]), PageDataListComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PageDataListComponent);
    component = fixture.componentInstance;
    component.state = {} as any;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
