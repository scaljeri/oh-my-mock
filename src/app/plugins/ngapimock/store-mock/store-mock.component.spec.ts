import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { StoreMockComponent } from './store-mock.component';
import { MatSnackBarModule } from '@angular/material/snack-bar';

describe('StoreMockComponent', () => {
  let component: StoreMockComponent;
  let fixture: ComponentFixture<StoreMockComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StoreMockComponent],
      imports: [HttpClientTestingModule, MatSnackBarModule],
      schemas: [NO_ERRORS_SCHEMA]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(StoreMockComponent);
    component = fixture.componentInstance;
    component.mockData = { url: 'url' } as any;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
