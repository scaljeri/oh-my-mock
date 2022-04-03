import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Subject } from 'rxjs';
import { OhMyStateService } from '../../services/state.service';

import { PageMockComponent } from './mock.component';

describe('MockComponent', () => {
  let component: PageMockComponent;
  let fixture: ComponentFixture<PageMockComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PageMockComponent ],
      imports: [RouterTestingModule.withRoutes([])],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: OhMyStateService, useValue: { state$: new Subject()}}
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PageMockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
