import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { NO_ERRORS_SCHEMA } from '@angular/core';
import { PageStateExplorerComponent } from './state-explorer.component';
import { OhMyStateService } from '../../services/state.service';
import { StorageService } from '../../services/storage.service';
import { OhMyState } from '../../services/oh-my-store';
import { Subject } from 'rxjs';
import { WebWorkerService } from '../../services/web-worker.service';

describe('StateExplorerComponent', () => {
  let component: PageStateExplorerComponent;
  let fixture: ComponentFixture<PageStateExplorerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PageStateExplorerComponent],
      imports: [
        RouterTestingModule.withRoutes([])
      ],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: OhMyStateService, useValue: { store$: new Subject() } },
        { provide: StorageService, useValue: {} },
        { provide: OhMyState, useValue: {} },
        { provide: WebWorkerService, useValue: {} }
      ]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PageStateExplorerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
