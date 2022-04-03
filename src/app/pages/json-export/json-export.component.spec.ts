import { NO_ERRORS_SCHEMA } from '@angular/core';
import { RouterTestingModule } from "@angular/router/testing";
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HotToastService } from '@ngneat/hot-toast';
import { StorageService } from '../../services/storage.service';
import { OhMyStateService } from '../../services/state.service';

import { JsonExportComponent } from './json-export.component';
import { Subject } from 'rxjs';
import { AppStateService } from '../../services/app-state.service';

describe('JsonExportComponent', () => {
  let component: JsonExportComponent;
  let fixture: ComponentFixture<JsonExportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [JsonExportComponent],
      imports: [RouterTestingModule.withRoutes([])],
      providers: [
        { provide: AppStateService, useValue: {} },
        { provide: HotToastService, useValue: {} },
        { provide: StorageService, useValue: {} },
        { provide: OhMyStateService, useValue: { state: { data: {}}} },
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(JsonExportComponent);
    component = fixture.componentInstance;
    Object.defineProperty(component, 'state$', {
      get: () => new Subject()
    });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
