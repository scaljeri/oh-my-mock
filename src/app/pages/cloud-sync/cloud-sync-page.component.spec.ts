import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CloudSyncPageComponent } from './cloud-sync-page.component';

describe('CloudSyncComponent', () => {
  let component: CloudSyncPageComponent;
  let fixture: ComponentFixture<CloudSyncPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CloudSyncPageComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CloudSyncPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
