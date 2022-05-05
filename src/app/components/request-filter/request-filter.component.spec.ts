import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WebWorkerService } from '../../services/web-worker.service';

import { RequestFilterComponent } from './request-filter.component';

describe('RequestFilterComponent', () => {
  let component: RequestFilterComponent;
  let fixture: ComponentFixture<RequestFilterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RequestFilterComponent ],
      providers: [
        { provide: WebWorkerService, useValue: {}}
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RequestFilterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
