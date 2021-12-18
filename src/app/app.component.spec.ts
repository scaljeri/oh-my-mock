import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { AppComponent } from './app.component';
import { AppStateService } from './services/app-state.service';
import { ContentService } from './services/content.service';
import { OhMyState } from './services/oh-my-store';
import { OhMyStateService } from './services/state.service';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      providers: [
        { provide: AppStateService, useValue: {} },
        { provide: OhMyState, useValue: {} },
        { provide: Router, useValue: {} },
        { provide: MatDialog, useValue: {} },
        { provide: OhMyStateService, useValue: {} },
        { provide: ContentService, useValue: {} },
        { provide: ActivatedRoute, useValue: {} }
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
