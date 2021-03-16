import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditDataComponent } from './edit-data.component';
import { PrettyPrintPipe } from '../../pipes/pretty-print.pipe';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('EditDataComponent', () => {
  let component: EditDataComponent;
  let fixture: ComponentFixture<EditDataComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [EditDataComponent],
      providers: [
        { provide: PrettyPrintPipe, useValue: { transform: () => {} } },
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(EditDataComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
