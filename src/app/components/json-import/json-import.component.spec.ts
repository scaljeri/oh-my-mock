import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { AppStateService } from '../../services/app-state.service';
import { OhMyStateService } from '../../services/state.service';
import { StorageService } from '../../services/storage.service';

import { JsonImportComponent } from './json-import.component';

describe('JsonImportComponent', () => {
  let component: JsonImportComponent;
  let fixture: ComponentFixture<JsonImportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [JsonImportComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: AppStateService, useValue: {} },
        { provide: OhMyStateService, useValue: {} },
        { provide: StorageService, useValue: {} },
        { provide: MatDialogRef, useValue: { close: jest.fn() } }]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(JsonImportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
