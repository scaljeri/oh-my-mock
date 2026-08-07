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
  /** Resolves the moment the component closes the dialog — see `whenClosed`. */
  let closed: Promise<void>;

  beforeEach(async () => {
    importJSONMock.mockReset();
    toast = { success: jest.fn(), error: jest.fn(), warning: jest.fn() };
    closed = new Promise<void>(resolve => {
      dialogClose = jest.fn(() => resolve());
    });

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

  /**
   * Waits for the dialog to close, which is what says the whole flow ran.
   *
   * Resolved by the spy itself, not by a clock. This used to poll every 25ms
   * against a 4000ms deadline — and that deadline was read by a timer sitting
   * in the same event-loop queue it was timing, so one multi-second stall (this
   * box has run with its swap completely full) reported "the import never
   * finished" for an import that had finished 25ms later. Measured: with a
   * stall injected past the deadline, the dialog closed on the very next tick,
   * nine times out of nine.
   *
   * Nothing here is timed any more, so no amount of load can change the answer.
   */
  function whenClosed(): Promise<void> {
    return closed;
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

  /**
   * Fails the read the way a file that moved between the picker and the read
   * does: `error` instead of `load`. The real `FileReader` stays in place —
   * only the read itself is replaced — because the handlers under test are the
   * zone-patched `on*` properties, and a hand-rolled stand-in would not have
   * them.
   */
  function failTheRead(): jest.SpyInstance {
    return jest.spyOn(FileReader.prototype, 'readAsText')
      .mockImplementation(function (this: FileReader) {
        setTimeout(() => this.dispatchEvent(new Event('error')));
      });
  }

  it('says so when the file cannot be read at all', async () => {
    const read = failTheRead();

    upload('never gets there');
    // Not "did it report the right thing" but "did it report at all": a read
    // that fails fires neither `load` nor anything the import path listened
    // for, so the flow stopped between the file and the first line of work —
    // no toast, no spinner reset, and a dialog left open over an upload that
    // was never going to happen.
    await whenClosed();

    expect(toast.error).toHaveBeenCalledWith('File backup.json could not be read');
    expect(component.isUploading).toBe(false);
    expect(importJSONMock).not.toHaveBeenCalled();

    read.mockRestore();
  });

  it('stays in the uploading state for as long as the import runs', async () => {
    // The 500ms delay was added because the spinner could not otherwise
    // appear at all, so removing it has to leave the spinner working — or the
    // trade is half a second of latency for a dialog that sits there looking
    // like nothing happened. What holds it on screen now is the import's own
    // `await`: it hands the task back, change detection runs, and the browser
    // gets its chance to paint. So `isUploading` has to stay true across that
    // await, which is what this pins — an import that finished before the
    // spinner had any way to appear would fail here.
    //
    // The assertion is on the flag rather than on `oh-my-spinner` in the DOM
    // because no binding on this component re-renders under TestBed:
    // `detectChanges()`, `ApplicationRef.tick()` and `autoDetectChanges()`
    // all leave the `@if` anchor empty and `[ngClass]` unapplied, with
    // `isUploading` plainly true on the fixture's own instance. That is a
    // pre-existing harness problem — it reproduces with nothing but
    // `component.isUploading = true; fixture.detectChanges();` — and worth
    // fixing, but it is not this flow's, and the flag is the whole of what
    // the template reads.
    let finishImport!: (result: unknown) => void;

    importJSONMock.mockReturnValue(
      new Promise((resolve) => {
        finishImport = resolve;
      })
    );

    upload(JSON.stringify({ requests: [], responses: [], version: '1.0.0' }));

    // The real FileReader delivers on its own schedule, so this waits for the
    // component to reach its await rather than assuming it already has.
    const started = Date.now();

    while (!component.isUploading) {
      if (Date.now() - started > 4000) {
        throw new Error('the import never started');
      }

      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    // Still mid-import: the dialog is open and the spinner's flag is up.
    expect(dialogClose).not.toHaveBeenCalled();
    expect(component.isUploading).toBe(true);

    finishImport({
      status: ImportResultEnum.SUCCESS,
      requests: 0,
      responses: 0
    });
    await whenClosed();

    expect(component.isUploading).toBe(false);
  });

  it('does not gate the import behind a timer', async () => {
    // The import used to sit behind a 500ms `setTimeout`, added when this
    // body was synchronous and the spinner could not otherwise paint (#95,
    // 2021-07) and left in place when storage went async (#105, 2021-11) —
    // where its reason ended and it stayed anyway. It cost every import half
    // a second of spinning over nothing, and a file that was not JSON half a
    // second before being told so.
    //
    // The clock is frozen for this test and never advanced, so a timer of any
    // duration between reading the file and importing it can never fire:
    // restore one and this test stops at the `importJSON` expectation. A
    // wall-clock bound would have asserted the same thing far more weakly —
    // it would only fail on a delay longer than whatever margin was chosen,
    // and would flake on a loaded machine.
    //
    // The stand-in reader exists because jsdom delivers a real `FileReader`'s
    // `onload` through machinery fake timers do not drive, so the real one
    // never fires on a frozen clock. Firing it by hand also makes "the file
    // has been read" a moment this test chooses rather than one it waits for.
    const originalFileReader = window.FileReader;

    class HandFiredReader {
      onload: ((event: unknown) => void) | null = null;

      readAsText(): void {
        this.onload?.({
          target: { result: JSON.stringify({ requests: [{}], responses: [], version: '1.0.0' }) }
        });
      }
    }

    importJSONMock.mockResolvedValue({
      status: ImportResultEnum.SUCCESS,
      requests: 1,
      responses: 0
    });

    window.FileReader = HandFiredReader as unknown as typeof FileReader;
    jest.useFakeTimers();

    try {
      upload('unused — the reader above supplies the text');

      // Promise callbacks are microtasks, which fake timers leave alone: this
      // drains the import's own `await` chain without moving the clock by a
      // single millisecond.
      for (let i = 0; i < 20; i++) {
        await Promise.resolve();
      }

      expect(importJSONMock).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith(
        'Imported 1 requests and 0 responses from backup.json into test.dev'
      );
      expect(dialogClose).toHaveBeenCalled();
      expect(component.isUploading).toBe(false);
    } finally {
      jest.useRealTimers();
      window.FileReader = originalFileReader;
    }
  });
});
