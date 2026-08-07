import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { HotToastService } from '@ngxpert/hot-toast';
import { ImportResultEnum } from '@shared/utils/import-json';
import { AppStateService } from '../../services/app-state.service';
import { OhMyState } from '../../services/oh-my-store';
import { OhMyStateService } from '../../services/state.service';
import { StorageService } from '../../services/storage.service';

import { JsonImportComponent } from './json-import.component';

/**
 * The import itself runs in the background now, so what this component does is
 * send one message and report the answer — and that is what is doubled here.
 *
 * It used to double `importJSON` with a `jest.mock` of the module, from the
 * days when the component called it in the popup's own process. Doubling it
 * still would prove nothing about this component: a call to it from here would
 * no longer be a write the wipe barrier can see, which is the very thing the
 * move was for.
 */
const importMock = jest.fn();

describe('JsonImportComponent', () => {
  let component: JsonImportComponent;
  let fixture: ComponentFixture<JsonImportComponent>;
  let toast: { success: jest.Mock, error: jest.Mock, warning: jest.Mock };
  let dialogClose: jest.Mock;
  /** Resolves the moment the component closes the dialog — see `whenClosed`. */
  let closed: Promise<void>;

  beforeEach(async () => {
    importMock.mockReset();
    toast = { success: jest.fn(), error: jest.fn(), warning: jest.fn() };
    closed = new Promise<void>(resolve => {
      dialogClose = jest.fn(() => resolve());
    });

    // No `NO_ERRORS_SCHEMA`. Everything the template names — `oh-my-file-uploader`
    // and `oh-my-spinner` — is a real standalone component the component itself
    // imports, so the schema only stood to swallow an element that had stopped
    // being one, and the spinner assertions below would then pass against
    // nothing.
    await TestBed.configureTestingModule({
      imports: [JsonImportComponent],
      providers: [
        { provide: AppStateService, useValue: { domain: 'test.dev' } },
        { provide: OhMyStateService, useValue: { state: { context: { domain: 'test.dev' } } } },
        { provide: OhMyState, useValue: { importBackup: importMock } },
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
    importMock.mockResolvedValue({ status: ImportResultEnum.SUCCESS, requests: 1, responses: 1 });

    upload(JSON.stringify({ requests: [{}, {}], responses: [{}, {}], version: '1.0.0' }));
    await whenClosed();

    expect(toast.success).toHaveBeenCalledWith(
      'Imported 1 requests and 1 responses from backup.json into test.dev'
    );
    expect(toast.warning).toHaveBeenCalledWith(
      '2 records were too old to migrate and skipped'
    );
  });

  /**
   * A reset that arrives while the import is running wins: the background
   * writes the records, the wipe deletes them, and the answer says DISCARDED.
   * The one thing the dialog must not do then is congratulate the user on an
   * import that no longer exists — "Imported N requests and M responses" over
   * a domain that was emptied a moment later is a sentence with nothing behind
   * it, and the user has no other way of finding out.
   */
  it('does not claim an import a reset threw away', async () => {
    importMock.mockResolvedValue({
      status: ImportResultEnum.DISCARDED,
      requests: 0,
      responses: 0
    });

    upload(JSON.stringify({ requests: [{}], responses: [{}], version: '1.0.0' }));
    await whenClosed();

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledWith(
      'Nothing was imported from backup.json: everything was reset while the import was running. Import it again to keep it.'
    );
    // Not an error: nothing failed, and the header's error badge is for faults
    // the user did not ask for.
    expect(toast.error).not.toHaveBeenCalled();
  });

  /**
   * ERROR became reachable when the import moved to the background — it is
   * what the handler answers for a backup it could not store, and for a packet
   * that arrived without a context. The component used to have no branch for
   * it at all, so the dialog closed in silence over an import that had not
   * happened.
   */
  it('says so when the background could not store the backup', async () => {
    importMock.mockResolvedValue({
      status: ImportResultEnum.ERROR,
      requests: 0,
      responses: 0
    });

    upload(JSON.stringify({ requests: [{}], responses: [], version: '1.0.0' }));
    await whenClosed();

    expect(toast.error).toHaveBeenCalledWith('Import of backup.json failed');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('does not blame the JSON when the import itself fails', async () => {
    importMock.mockRejectedValue(new Error('storage is gone'));

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
    expect(importMock).not.toHaveBeenCalled();
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
    expect(importMock).not.toHaveBeenCalled();

    read.mockRestore();
  });

  const spinner = (): Element | null =>
    fixture.nativeElement.querySelector('oh-my-spinner');
  const uploaderIsBusy = (): boolean =>
    fixture.nativeElement.querySelector('oh-my-file-uploader')
      .classList.contains('is-busy');

  it('shows the spinner for as long as the import runs', async () => {
    // The 500ms delay was added because the spinner could not otherwise
    // appear at all, so removing it has to leave the spinner working — or the
    // trade is half a second of latency for a dialog that sits there looking
    // like nothing happened. What holds it on screen now is the import's own
    // `await`: it hands the task back, change detection runs, and the browser
    // gets its chance to paint. So the spinner has to be on screen across that
    // await, which is what this pins — an import that finished before the
    // spinner had any way to appear would fail here.
    //
    // This asserts the rendered DOM rather than `isUploading`, because the flag
    // being true is not the same claim as the spinner being visible, and under
    // Angular 22 the two came apart: OnPush is the default now, so setting the
    // flag from the `FileReader` callback dirtied nothing and the `@if` never
    // opened. The flag was true throughout and the dialog showed no spinner.
    let finishImport!: (result: unknown) => void;
    let importStarted!: () => void;
    /**
     * Resolves when the component sends the backup off, which is the first thing
     * it does after raising the spinner — so awaiting it lands exactly on the
     * moment the spinner is supposed to be up, with the component parked on its
     * own `await`.
     *
     * Untimed on purpose, like `whenClosed`. The real `FileReader` delivers on
     * its own schedule, and the obvious way to wait for it is to poll against a
     * deadline — which is the pattern this file already had to remove once,
     * because the deadline was read by a timer queued behind the very work it
     * was timing, and one stall on a loaded box turned a passing flow into
     * "it never started". Nothing here is timed, so no amount of load can
     * change the answer.
     */
    const whenImportStarts = new Promise<void>((resolve) => {
      importStarted = resolve;
    });

    importMock.mockImplementation(() => {
      importStarted();

      return new Promise((resolve) => {
        finishImport = resolve;
      });
    });

    upload(JSON.stringify({ requests: [], responses: [], version: '1.0.0' }));
    await whenImportStarts;
    fixture.detectChanges();

    // Still mid-import: the dialog is open and the spinner is on screen, with
    // the uploader dimmed behind it.
    expect(spinner()).not.toBeNull();
    expect(dialogClose).not.toHaveBeenCalled();
    expect(uploaderIsBusy()).toBe(true);

    finishImport({
      status: ImportResultEnum.SUCCESS,
      requests: 0,
      responses: 0
    });
    await whenClosed();
    fixture.detectChanges();

    expect(spinner()).toBeNull();
    expect(uploaderIsBusy()).toBe(false);
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
    // restore one and this test stops at the `importMock` expectation. A
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

    importMock.mockResolvedValue({
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

      expect(importMock).toHaveBeenCalled();
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
