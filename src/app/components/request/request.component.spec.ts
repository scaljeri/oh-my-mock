import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { HotToastService } from '@ngneat/hot-toast';
import { Subject } from 'rxjs';
import { OhMyState } from '../../services/oh-my-store';
import { OhMyStateService } from '../../services/state.service';
import { StorageService } from '../../services/storage.service';
import { RequestComponent } from './request.component';

describe('MockComponent', () => {
  let component: RequestComponent;
  let fixture: ComponentFixture<RequestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RequestComponent],
      providers: [
        { provide: MatDialog, useValue: {} },
        { provide: Router, useValue: {} },
        { provide: OhMyState, useValue: {} },
        { provide: OhMyStateService, useValue: {response$: new Subject()} },
        { provide: StorageService, useValue: {} },
        { provide: HotToastService, useValue: {} },
        { provide: ActivatedRoute, useValue: { snapshot: { params: {} } } },
      ],
      imports: [],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RequestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
