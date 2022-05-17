import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConnectionFailureComponent } from './connection-failure.component';

describe('ConnectionFailureComponent', () => {
  let component: ConnectionFailureComponent;
  let fixture: ComponentFixture<ConnectionFailureComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ConnectionFailureComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ConnectionFailureComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
