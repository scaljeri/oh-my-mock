import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgxsModule } from '@ngxs/store';
import { RouterTestingModule } from '@angular/router/testing';

import { NO_ERRORS_SCHEMA } from '@angular/core';
import { PageStateExplorerComponent } from './state-explorer.component';

describe('StateExplorerComponent', () => {
  let component: PageStateExplorerComponent;
  let fixture: ComponentFixture<PageStateExplorerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PageStateExplorerComponent],
      imports: [
        NgxsModule.forRoot([]),
        RouterTestingModule.withRoutes([])
      ],
      schemas: [NO_ERRORS_SCHEMA]
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
