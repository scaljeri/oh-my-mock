import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgxsModule } from '@ngxs/store';

import { StateExplorerComponent } from './state-explorer.component';

describe('StateExplorerComponent', () => {
  let component: StateExplorerComponent;
  let fixture: ComponentFixture<StateExplorerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StateExplorerComponent],
      imports: [NgxsModule.forRoot([])],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(StateExplorerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
