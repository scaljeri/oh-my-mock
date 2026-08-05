import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { HotToastService } from '@ngxpert/hot-toast';
import { objectTypes } from '@shared/constants';
import { IMock } from '@shared/types/mock';
import { IData } from '@shared/types/request';
import { IState } from '@shared/types/state';
import { importJSON, ImportResultEnum } from '@shared/utils/import-json';
import { AppStateService } from '../../services/app-state.service';
import { OhMyState } from '../../services/oh-my-store';
import { HarImportComponent } from './har-import.component';

jest.mock('@shared/utils/import-json', () => ({
  ...jest.requireActual('@shared/utils/import-json'),
  importJSON: jest.fn()
}));

const importJSONMock = jest.mocked(importJSON);

interface IEntryOptions {
  url?: string;
  method?: string;
  resourceType?: string;
  status?: number;
  text?: string | null;
}

function entry(options: IEntryOptions = {}): unknown {
  const {
    url = 'https://api.example.com/v1/users',
    method = 'GET',
    resourceType = 'fetch',
    status = 200,
    text = '{"ok":true}'
  } = options;

  return {
    _resourceType: resourceType,
    request: { method, url, headers: [] },
    response: {
      status,
      headers: [{ name: 'content-type', value: 'application/json' }],
      content: {
        mimeType: 'application/json',
        ...(text !== null && { text })
      }
    }
  };
}

/** A one-file list, which is what the uploader emits. */
function harFile(entries: unknown[], name = 'session.har'): File[] {
  return [new File(
    [JSON.stringify({ log: { version: '1.2', entries } })], name, { type: 'application/json' })];
}

function isMock(record: unknown): record is IMock {
  return typeof record === 'object' && record !== null && 'statusCode' in record;
}

function storedRequest(overrides: Partial<IData> = {}): IData {
  return {
    id: 'stored-1',
    url: '/v1/users',
    method: 'GET',
    requestType: 'FETCH',
    selected: {},
    enabled: {},
    mocks: {},
    lastHit: 0,
    lastModified: 0,
    version: '9.9.9',
    type: objectTypes.REQUEST,
    ...overrides
  };
}

describe('HarImportComponent', () => {
  let component: HarImportComponent;
  let fixture: ComponentFixture<HarImportComponent>;
  let appState: { domain: string };
  let existing: IData[];
  let closed: unknown[];
  let toasts: { success: string[]; error: string[] };

  beforeEach(async () => {
    appState = { domain: 'app.example.com' };
    existing = [];
    closed = [];
    toasts = { success: [], error: [] };
    importJSONMock.mockReset();
    importJSONMock.mockResolvedValue({ status: ImportResultEnum.SUCCESS, requests: 1, responses: 1 });

    await TestBed.configureTestingModule({
      // `ohStatusCodeTone` is a real pipe: an unknown one throws even under
      // NO_ERRORS_SCHEMA, and every row would silently fail to render.
      imports: [FormsModule, HarImportComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: AppStateService, useValue: appState },
        {
          provide: OhMyState,
          useValue: {
            getState: (context: { domain: string }) => Promise.resolve({
              domain: context.domain,
              context: { domain: context.domain, preset: 'default' }
            } as IState),
            getRequests: () => Promise.resolve(existing)
          }
        },
        {
          provide: HotToastService,
          useValue: {
            success: (msg: string) => toasts.success.push(msg),
            error: (msg: string) => toasts.error.push(msg)
          }
        },
        { provide: MatDialogRef, useValue: { close: (v: unknown) => closed.push(v) } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HarImportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('starts at the file picker, with the popup\'s domain as the target', () => {
    expect(component.phase).toBe('pick');
    expect(component.targetDomain).toBe('app.example.com');
  });

  describe('a file that is not a HAR', () => {
    it('says so and stays on the picker', async () => {
      await component.onUploadFile([new File(['not json at all'], 'notes.txt')]);

      expect(component.phase).toBe('pick');
      expect(component.error).toContain('Not valid JSON');
      expect(toasts.error.length).toBe(1);
    });

    it('tells a JSON file that is not a HAR apart from broken JSON', async () => {
      await component.onUploadFile([
        new File([JSON.stringify({ requests: [], responses: [] })], 'backup.json')
      ]);

      expect(component.phase).toBe('pick');
      expect(component.error).toContain('no `log` object');
    });

    it('does nothing at all when no file was picked', async () => {
      await component.onUploadFile(undefined);
      await component.onUploadFile([]);

      expect(component.phase).toBe('pick');
      expect(component.error).toBeUndefined();
    });
  });

  describe('after reading a file', () => {
    beforeEach(async () => {
      await component.onUploadFile(harFile([
        entry({ url: 'https://api.example.com/v1/users' }),
        entry({ url: 'https://api.example.com/v1/teams', method: 'POST' }),
        entry({ url: 'https://cdn.example.com/logo.png', resourceType: 'image' }),
        entry({ url: 'https://api.example.com/v1/none', text: null })
      ]));
      fixture.detectChanges();
    });

    it('lists what can be mocked and counts what was skipped', () => {
      expect(component.phase).toBe('review');
      expect(component.rows.length).toBe(3);
      expect(component.parsed?.total).toBe(4);
      expect(component.skipSummary).toBe('1 not an API call');
    });

    it('selects everything that has a recorded body', () => {
      expect(component.rows.map(r => r.selected)).toEqual([true, true, false]);
      expect(component.selectedCount).toBe(2);
    });

    it('renders a row per candidate', () => {
      const rows = fixture.nativeElement.querySelectorAll('.oh-har__row');

      expect(rows.length).toBe(3);
    });

    it('filters on path, host and method', () => {
      component.filter = 'teams';
      component.applyFilter();
      expect(component.visibleRows.length).toBe(1);

      component.filter = 'POST';
      component.applyFilter();
      expect(component.visibleRows.length).toBe(1);

      component.filter = 'api.example.com';
      component.applyFilter();
      expect(component.visibleRows.length).toBe(3);
    });

    it('selects and clears only what the filter shows', () => {
      component.filter = 'teams';
      component.applyFilter();
      component.onSelectAll(false);

      expect(component.selectedCount).toBe(1);

      component.filter = '';
      component.applyFilter();
      component.onSelectAll(true);

      expect(component.selectedCount).toBe(3);
    });

    it('imports the picked candidates into the target domain', async () => {
      await component.onImport();

      expect(importJSONMock).toHaveBeenCalledTimes(1);
      const [backup, context] = importJSONMock.mock.calls[0];

      expect(backup.requests.length).toBe(2);
      expect(backup.responses.length).toBe(2);
      expect(context).toEqual({ domain: 'app.example.com', preset: 'default', active: true });
      expect(closed).toEqual([2]);
      expect(toasts.success[0]).toContain('session.har');
    });

    it('labels every imported response with the file it came from', async () => {
      await component.onImport();

      const [backup] = importJSONMock.mock.calls[0];

      // `IOhMyBackupInput` describes records that may still need migrating, so
      // its lists are typed as "something with a version". Narrowing rather
      // than casting keeps the assertion honest about what it is looking at.
      expect(backup.responses.filter(isMock).map(r => r.label))
        .toEqual(['session.har', 'session.har']);
    });

    it('does nothing when nothing is selected', async () => {
      component.onSelectAll(false);
      await component.onImport();

      expect(importJSONMock).not.toHaveBeenCalled();
    });

    it('does nothing without a target domain', async () => {
      await component.onDomainChange('   ');
      await component.onImport();

      expect(importJSONMock).not.toHaveBeenCalled();
    });

    it('reports a failed import rather than closing on it', async () => {
      importJSONMock.mockRejectedValueOnce(new Error('storage is full'));

      await component.onImport();

      expect(component.phase).toBe('review');
      expect(component.error).toContain('storage is full');
      expect(closed).toEqual([]);
    });

    it('reports an import the store refused', async () => {
      importJSONMock.mockResolvedValueOnce({ status: ImportResultEnum.TOO_OLD, requests: 0, responses: 0 });

      await component.onImport();

      expect(component.phase).toBe('review');
      expect(component.error).toContain('TOO_OLD');
      expect(closed).toEqual([]);
    });

    it('goes back to the picker on "another file"', () => {
      component.onStartOver();

      expect(component.phase).toBe('pick');
      expect(component.rows).toEqual([]);
    });
  });

  describe('requests the domain already has', () => {
    beforeEach(() => {
      existing = [storedRequest()];
    });

    it('leaves them unselected and marks them', async () => {
      await component.onUploadFile(harFile([entry()]));

      expect(component.rows[0].existing?.id).toBe('stored-1');
      expect(component.rows[0].selected).toBe(false);
    });

    it('keeps a choice the user made when the target domain changes', async () => {
      existing = [];
      await component.onUploadFile(harFile([entry()]));

      component.onToggle(component.rows[0]); // switched off by hand
      existing = [storedRequest({ url: '/nothing/like/it' })];
      await component.onDomainChange('other.example.com');

      expect(component.rows[0].selected).toBe(false);
    });

    it('re-checks against the domain that is now the target', async () => {
      existing = [];
      await component.onUploadFile(harFile([entry()]));
      expect(component.rows[0].selected).toBe(true);

      existing = [storedRequest()];
      await component.onDomainChange('other.example.com');

      expect(component.rows[0].existing?.id).toBe('stored-1');
      expect(component.rows[0].selected).toBe(false);
    });
  });

  describe('the domain the session was recorded on', () => {
    const withDocument = [
      { _resourceType: 'document', request: { method: 'GET', url: 'https://shop.example.com/' }, response: { status: 200, headers: [], content: {} } },
      entry()
    ];

    it('is offered when it differs from the domain the popup shows', async () => {
      await component.onUploadFile(harFile(withDocument));

      expect(component.suggestedDomain).toBe('shop.example.com');
      expect(component.targetDomain).toBe('app.example.com');
    });

    it('is taken over on request', async () => {
      await component.onUploadFile(harFile(withDocument));
      component.useSuggestedDomain();
      await component.onImport();

      expect(importJSONMock.mock.calls[0][1].domain).toBe('shop.example.com');
    });

    it('is used outright when the popup has no domain of its own', async () => {
      appState.domain = '';
      component.targetDomain = '';

      await component.onUploadFile(harFile(withDocument));

      expect(component.targetDomain).toBe('shop.example.com');
      expect(component.suggestedDomain).toBeUndefined();
    });

    it('is not offered when it is the domain already selected', async () => {
      appState.domain = 'shop.example.com';
      component.targetDomain = 'shop.example.com';

      await component.onUploadFile(harFile(withDocument));

      expect(component.suggestedDomain).toBeUndefined();
    });

    it('switches the popup to the domain that was imported into', async () => {
      await component.onUploadFile(harFile(withDocument));
      component.useSuggestedDomain();
      await component.onImport();

      expect(appState.domain).toBe('shop.example.com');
    });
  });

  describe('formatBytes', () => {
    it('reads the way DevTools does', () => {
      expect(component.formatBytes(0)).toBe('0 B');
      expect(component.formatBytes(512)).toBe('512 B');
      expect(component.formatBytes(2048)).toBe('2.0 kB');
      expect(component.formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    });
  });
});
