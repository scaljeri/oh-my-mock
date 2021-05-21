import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CloudSyncComponent } from './cloud-sync.component';

describe('CloudSyncComponent', () => {
  let component: CloudSyncComponent;
  let fixture: ComponentFixture<CloudSyncComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CloudSyncComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CloudSyncComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
