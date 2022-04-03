import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { OhMyState } from '../../../services/oh-my-store';

import { RequestHeaderComponent } from './request-header.component';

describe('MockHeaderComponent', () => {
  let component: RequestHeaderComponent;
  let fixture: ComponentFixture<RequestHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RequestHeaderComponent],
      imports: [MatAutocompleteModule],
      providers: [
        { provide: MatDialog, useValue: {} },
        { provide: OhMyState, useValue: {} },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RequestHeaderComponent);
    component = fixture.componentInstance;
    component.state = {} as any;
    component.request = { mocks: {}, enabled: {}} as any;
    component.context = {} as any;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
