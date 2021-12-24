import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VersionMismatchComponent } from './version-mismatch.component';

describe('VersionMismatchComponent', () => {
  let component: VersionMismatchComponent;
  let fixture: ComponentFixture<VersionMismatchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ VersionMismatchComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(VersionMismatchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
