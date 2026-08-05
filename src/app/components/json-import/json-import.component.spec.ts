import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { HotToastService } from '@ngxpert/hot-toast';
import { importJSON, ImportResultEnum } from '@shared/utils/import-json';
import { AppStateService } from '../../services/app-state.service';
import { OhMyStateService } from '../../services/state.service';
import { StorageService } from '../../services/storage.service';

import { JsonImportComponent } from './json-import.component';

// The component is under test, not the import itself — that has its own spec
// next to `import-json.ts`. Only `importJSON` is doubled; the enum stays real.
jest.mock('@shared/utils/import-json', () => ({
  ...jest.requireActual('@shared/utils/import-json'),
  importJSON: jest.fn()
}));

const importJSONMock = importJSON as jest.Mock;

describe('JsonImportComponent', () => {
  let component: JsonImportComponent;
  let fixture: ComponentFixture<JsonImportComponent>;
  let toast: { success: jest.Mock, error: jest.Mock, warning: jest.Mock };
  let dialogClose: jest.Mock;

  beforeEach(async () => {
    importJSONMock.mockReset();
    toast = { success: jest.fn(), error: jest.fn(), warning: jest.fn() };
    dialogClose = jest.fn();

    await TestBed.configureTestingModule({
      imports: [JsonImportComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: AppStateService, useValue: { domain: 'test.dev' } },
        { provide: OhMyStateService, useValue: { state: { context: { domain: 'test.dev' } } } },
        { provide: StorageService, useValue: {} },
        { provide: HotToastService, useValue: toast },
        { provide: MatDialogRef, useValue: { close: dialogClose } }]
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

  function upload(text: string): void {
    const file = new File([text], 'backup.json', { type: 'application/json' });

    // `Array.from` inside the component is what lets a plain array stand in
    // for the `FileList` the uploader would hand over.
    component.onUploadFile([file] as unknown as FileList);
  }

  // The upload path is FileReader plus a deliberate 500ms delay, neither of
  // which the test can await directly — but the dialog closes at the end of
  // every outcome, so that is the signal the whole flow has run.
  function whenClosed(): Promise<void> {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const poll = () => {
        if (dialogClose.mock.calls.length) {
          return resolve();
        }

        if (Date.now() - started > 4000) {
          return reject(new Error('the import never finished'));
        }

        setTimeout(poll, 25);
      };

      poll();
    });
  }

  it('reports what was imported, not what the file held', async () => {
    // Two of each in the file, one of each stored: the rest was too old to
    // migrate, and the toast must not claim otherwise.
    importJSONMock.mockResolvedValue({ status: ImportResultEnum.SUCCESS, requests: 1, responses: 1 });

    upload(JSON.stringify({ requests: [{}, {}], responses: [{}, {}], version: '1.0.0' }));
    await whenClosed();

    expect(toast.success).toHaveBeenCalledWith(
      'Imported 1 requests and 1 responses from backup.json into test.dev'
    );
    expect(toast.warning).toHaveBeenCalledWith(
      '2 records were too old to migrate and skipped'
    );
  });

  it('does not blame the JSON when the import itself fails', async () => {
    importJSONMock.mockRejectedValue(new Error('storage is gone'));

    upload(JSON.stringify({ requests: [], responses: [], version: '1.0.0' }));
    await whenClosed();

    expect(toast.error).toHaveBeenCalledWith('Import of backup.json failed');
    expect(component.isUploading).toBe(false);
  });

  it('still reports a file that is not JSON as exactly that', async () => {
    upload('certainly-not-json');
    await whenClosed();

    expect(toast.error).toHaveBeenCalledWith(
      'File backup.json does not contain (valid) JSON'
    );
    expect(importJSONMock).not.toHaveBeenCalled();
  });
});
