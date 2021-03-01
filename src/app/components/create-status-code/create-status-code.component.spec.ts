import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateStatusCodeComponent } from './create-status-code.component';

describe('CreateStatusCodeComponent', () => {
  let component: CreateStatusCodeComponent;
  let fixture: ComponentFixture<CreateStatusCodeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CreateStatusCodeComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CreateStatusCodeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
