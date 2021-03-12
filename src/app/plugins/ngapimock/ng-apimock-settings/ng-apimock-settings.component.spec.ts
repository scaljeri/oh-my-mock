import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NgApimockSettingsComponent } from './ng-apimock-settings.component';

describe('NgApimockSettingsComponent', () => {
  let component: NgApimockSettingsComponent;
  let fixture: ComponentFixture<NgApimockSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ NgApimockSettingsComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NgApimockSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
