import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageScenariosComponent } from './manage-scenarios.component';

describe('ManageScenariosComponent', () => {
  let component: ManageScenariosComponent;
  let fixture: ComponentFixture<ManageScenariosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ManageScenariosComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ManageScenariosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
