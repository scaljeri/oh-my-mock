import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HotToastService } from '@ngneat/hot-toast';
import { Store } from '@ngxs/store';
import { AppStateService } from 'src/app/services/app-state.service';

import { JsonExportComponent } from './json-export.component';

describe('JsonExportComponent', () => {
  let component: JsonExportComponent;
  let fixture: ComponentFixture<JsonExportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ JsonExportComponent ],
      providers: [
        { provide: AppStateService, useValue: {} },
        { provide: HotToastService, useValue: {} },
        { provide: Store, useValue: { selectSnapshot: jest.fn()} },
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(JsonExportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
