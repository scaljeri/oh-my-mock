import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgxsModule } from '@ngxs/store';
import { RouterTestingModule } from '@angular/router/testing';

import { StateExplorerComponent } from './state-explorer.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('StateExplorerComponent', () => {
  let component: StateExplorerComponent;
  let fixture: ComponentFixture<StateExplorerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StateExplorerComponent],
      imports: [
        NgxsModule.forRoot([]),
        RouterTestingModule.withRoutes([])
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(StateExplorerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
