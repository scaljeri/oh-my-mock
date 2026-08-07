import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { RouterTestingModule } from "@angular/router/testing";
import {
  ComponentFixture,
  TestBed,
  discardPeriodicTasks,
  fakeAsync,
  tick
} from '@angular/core/testing';
import { HotToastService } from '@ngxpert/hot-toast';
import { IData, IMock, IOhMyBackup, IState } from '@shared/type';
import { objectTypes } from '@shared/constants';
import { StorageService } from '../../services/storage.service';
import { OhMyStateService } from '../../services/state.service';

import { JsonExportComponent } from './json-export.component';
import { Subject, of } from 'rxjs';
import { AnimationBuilder } from '@angular/animations';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { AppStateService } from '../../services/app-state.service';
import { OhMyState } from '../../services/oh-my-store';
import { WebWorkerService } from '../../services/web-worker.service';

const VERSION = '3.5.0';

// What `StorageService.get` answers per response id; `mOrphan` deliberately has
// no record, which is exactly the state an orphaned shallow entry leaves behind.
const STORED_RESPONSES: Record<string, IMock> = {
  m200: { id: 'm200', statusCode: 200, version: VERSION, type: objectTypes.MOCK } as IMock,
  m500: { id: 'm500', statusCode: 500, version: VERSION, type: objectTypes.MOCK } as IMock
};

const request = (partial: Partial<IData>): IData => ({
  id: 'req',
  url: '/api',
  method: 'GET',
  requestType: 'XHR',
  selected: {},
  enabled: {},
  mocks: {},
  lastHit: 1,
  lastModified: 1,
  version: VERSION,
  type: objectTypes.REQUEST,
  ...partial
} as IData);

describe('JsonExportComponent', () => {
  let component: JsonExportComponent;
  let fixture: ComponentFixture<JsonExportComponent>;
  let toast: { success: jest.Mock, warning: jest.Mock };
  let state: IState;

  beforeEach(async () => {
    toast = { success: jest.fn(), warning: jest.fn() };
    state = {
      domain: 'test.dev',
      requests: ['req1'],
      presets: { p1: 'Default', p2: 'Offline' },
      context: { domain: 'test.dev', preset: 'p1' },
      aux: {},
      version: VERSION,
      type: objectTypes.STATE
    } as IState;

    await TestBed.configureTestingModule({
      imports: [RouterTestingModule.withRoutes([]), JsonExportComponent],
      providers: [
        { provide: AppStateService, useValue: { version: VERSION } },
        { provide: HotToastService, useValue: toast },
        {
          provide: StorageService,
          useValue: { get: jest.fn((id: string) => Promise.resolve(STORED_RESPONSES[id])) }
        },
        { provide: OhMyStateService, useValue: { state, requests$: new Subject() } },
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

  describe('onExport', () => {
    beforeEach(() => {
      // The navigation scheduled after a successful export would otherwise run
      // against a torn-down test router, 500ms into some later test.
      jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    });

    // The component hands the backup over as a `data:` url on an anchor it
    // clicks; intercepting that anchor is the only way to see what a user
    // would actually find in the downloaded file.
    async function doExport(): Promise<IOhMyBackup> {
      const anchor = { setAttribute: jest.fn(), click: jest.fn(), remove: jest.fn() };
      const createSpy = jest.spyOn(document, 'createElement')
        .mockReturnValue(anchor as unknown as HTMLElement);
      const appendSpy = jest.spyOn(document.body, 'appendChild')
        .mockImplementation((node) => node);

      try {
        await component.onExport();
      } finally {
        createSpy.mockRestore();
        appendSpy.mockRestore();
      }

      const href = anchor.setAttribute.mock.calls
        .find(([name]) => name === 'href')?.[1] as string;

      return JSON.parse(decodeURIComponent(href.replace('data:text/json;charset=utf-8,', '')));
    }

    it('writes a request once, however many responses it has', async () => {
      component.selected = {
        req1: request({
          id: 'req1',
          url: '/api/a',
          mocks: {
            m200: { id: 'm200', statusCode: 200 },
            m500: { id: 'm500', statusCode: 500 }
          }
        })
      };

      const backup = await doExport();

      expect(backup.requests).toHaveLength(1);
      expect(backup.responses).toHaveLength(2);
    });

    it('includes a request that has no responses yet', async () => {
      component.selected = {
        req1: request({ id: 'req1', url: '/api/empty' })
      };

      const backup = await doExport();

      expect(backup.requests).toHaveLength(1);
      expect(backup.requests[0].url).toBe('/api/empty');
      expect(backup.responses).toHaveLength(0);
    });

    it('survives an orphaned response id and exports the rest', async () => {
      component.selected = {
        req1: request({
          id: 'req1',
          url: '/api/a',
          mocks: {
            mOrphan: { id: 'mOrphan', statusCode: 404 },
            m200: { id: 'm200', statusCode: 200 }
          },
          selected: { p1: 'mOrphan' }
        })
      };

      const backup = await doExport();

      expect(backup.requests).toHaveLength(1);
      expect(backup.responses).toHaveLength(1);
      expect(backup.responses[0].statusCode).toBe(200);
      // The selection pointed at the orphan; claiming it in the file would
      // point the importer at a response that is not there.
      expect(backup.requests[0].selected).toEqual({});
    });

    it('keeps the per-preset selection and the presets themselves', async () => {
      component.selected = {
        req1: request({
          id: 'req1',
          url: '/api/a',
          mocks: {
            m200: { id: 'm200', statusCode: 200 },
            m500: { id: 'm500', statusCode: 500 }
          },
          selected: { p1: 'm500', p2: 'm200' },
          enabled: { p1: true, p2: false }
        })
      };

      const backup = await doExport();
      const exported = backup.requests[0];

      expect(backup.presets).toEqual({ p1: 'Default', p2: 'Offline' });
      expect(exported.enabled).toEqual({ p1: true, p2: false });

      // Responses get fresh ids in the file, so the selection must follow
      // them: each entry has to point at the exported copy of the response the
      // user actually chose.
      const exported500 = backup.responses.find((m) => m.statusCode === 500);
      const exported200 = backup.responses.find((m) => m.statusCode === 200);

      expect(exported.selected).toEqual({ p1: exported500?.id, p2: exported200?.id });
      expect(Object.keys(exported.mocks).sort()).toEqual(
        [exported200?.id, exported500?.id].sort()
      );
    });

    it('does not export calledAt — the importing browser never called anything', async () => {
      component.selected = {
        req1: request({ id: 'req1', url: '/api/a', calledAt: 1234567 })
      };

      const backup = await doExport();

      expect('calledAt' in backup.requests[0]).toBe(false);
    });
  });
});

/**
 * The list the export page picks from, rendered for real.
 *
 * A separate suite because it drops `NO_ERRORS_SCHEMA`: `[requests]` only
 * reaches the DOM through `oh-my-data-list`, and with the schema in place that
 * tag is an unknown element, so counting rows inside it would count nothing and
 * pass whatever the component did.
 */
describe('JsonExportComponent, rendering the request list', () => {
  let fixture: ComponentFixture<JsonExportComponent>;
  let requests$: Subject<Record<string, IData>>;
  let state: IState;

  const rows = (): NodeListOf<Element> =>
    fixture.nativeElement.querySelectorAll('[x-test="list-request-item"]');

  beforeEach(async () => {
    requests$ = new Subject<Record<string, IData>>();
    state = {
      domain: 'test.dev',
      requests: ['req1'],
      presets: { p1: 'Default' },
      context: { domain: 'test.dev', preset: 'p1' },
      aux: {},
      version: VERSION,
      type: objectTypes.STATE
    } as IState;

    await TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([]),
        MatMenuModule,
        JsonExportComponent
      ],
      providers: [
        AnimationBuilder,
        { provide: AppStateService, useValue: { version: VERSION } },
        { provide: HotToastService, useValue: { success: jest.fn(), warning: jest.fn() } },
        { provide: StorageService, useValue: { get: jest.fn() } },
        { provide: MatDialog, useValue: {} },
        { provide: WebWorkerService, useValue: {} },
        {
          provide: OhMyStateService,
          useValue: {
            state,
            requests$,
            groups$: of([]),
            // The list renders the preset dropdown, which opens a state
            // stream of its own the moment it gets a context.
            getState$: () => of(state),
            activeGroups: () => [],
            localGroup: () => undefined
          }
        },
        {
          provide: OhMyState,
          useValue: {
            getStore: async () => ({}),
            updateStore: async () => ({}),
            upsertState: jest.fn().mockResolvedValue(undefined)
          }
        }
      ]
    }).compileComponents();

  });

  /**
   * `fakeAsync` because `DataListComponent.state$` is `debounceTime(50)`, so
   * the child only recomputes its rows one timer after anything arrives. The
   * clock here is virtual and advanced by exactly that debounce — this is not a
   * wall-clock guess at how long the work takes, and no amount of load on the
   * machine can change what it does.
   */
  it('renders a request that arrives while the page is open', fakeAsync(() => {
    fixture = TestBed.createComponent(JsonExportComponent);
    fixture.detectChanges();
    tick(50);
    fixture.detectChanges();

    expect(rows().length).toBe(0);

    // In the popup this emission comes from the `chrome.storage.onChanged`
    // handler in `OhMyStateService` — a browser callback with no listener
    // anywhere near it. Asserting `component.requests` would pass without the
    // fix, because the field was always updated; the list was not.
    requests$.next({
      req1: request({ id: 'req1', url: '/api/a' }) as unknown as IData
    });
    fixture.detectChanges();
    tick(50);
    fixture.detectChanges();

    expect(rows().length).toBe(1);

    discardPeriodicTasks();
  }));
});
