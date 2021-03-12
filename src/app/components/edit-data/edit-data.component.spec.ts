import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PrettyPrintPipe } from 'src/app/pipes/pretty-print.pipe';
import { EditDataComponent } from './edit-data.component';

describe('EditDataComponent', () => {
  let component: EditDataComponent;
  let fixture: ComponentFixture<EditDataComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [EditDataComponent],
      providers: [
        { provide: PrettyPrintPipe, useValue: { transform: () => {} } },
      ],
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
