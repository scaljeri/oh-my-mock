import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MockDetailsComponent } from './mock-details.component';

describe('MockDetailsComponent', () => {
  let component: MockDetailsComponent;
  let fixture: ComponentFixture<MockDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MockDetailsComponent],
      schemas: [NO_ERRORS_SCHEMA],
      imports: [MatAutocompleteModule]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MockDetailsComponent);
    component = fixture.componentInstance;
    component.mock = {} as any;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
