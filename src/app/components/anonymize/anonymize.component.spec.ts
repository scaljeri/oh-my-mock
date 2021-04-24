import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnonymizeComponent } from './anonymize.component';

describe('AnonymizeComponent', () => {
  let component: AnonymizeComponent;
  let fixture: ComponentFixture<AnonymizeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AnonymizeComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AnonymizeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
