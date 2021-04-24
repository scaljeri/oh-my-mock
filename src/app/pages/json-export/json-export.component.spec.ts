import { NO_ERRORS_SCHEMA } from '@angular/core';
import { RouterTestingModule } from "@angular/router/testing";
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HotToastService } from '@ngneat/hot-toast';
import { NgxsModule, Store } from '@ngxs/store';
import { AppStateService } from 'src/app/services/app-state.service';

import { JsonExportComponent } from './json-export.component';
import { Subject } from 'rxjs';

describe('JsonExportComponent', () => {
  let component: JsonExportComponent;
  let fixture: ComponentFixture<JsonExportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [JsonExportComponent],
      imports: [RouterTestingModule.withRoutes([]), NgxsModule.forRoot()],
      providers: [
        { provide: AppStateService, useValue: {} },
        { provide: HotToastService, useValue: {} },
        { provide: Store, useValue: { selectSnapshot: jest.fn() } },
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
