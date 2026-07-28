import { ChangeDetectorRef, Component, OnDestroy, inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { HotToastService } from '@ngxpert/hot-toast';
import { IData } from '@shared/types/request';
import {
  findExistingRequest,
  groupHarEntries,
  harCandidatesToBackup,
  IOhMyHarCandidate,
  IOhMyHarSkipSummary,
  summariseHarSkips
} from '@shared/utils/har-import';
import { IOhMyHarParseSuccess, parseHar } from '@shared/utils/har-parse';
import { importJSON, ImportResultEnum } from '@shared/utils/import-json';
import { AppStateService } from '../../services/app-state.service';
import { OhMyState } from '../../services/oh-my-store';

/** One row of the picker: a request that will be created, and whether it will. */
export interface IOhMyHarRow {
  candidate: IOhMyHarCandidate;
  selected: boolean;
  /** The request the target domain already has for this url, if any. */
  existing?: IData;
}

export type harImportPhase = 'pick' | 'review' | 'importing';

/**
 * Imports a HAR file — what the DevTools Network panel exports — as mocks.
 *
 * The work is done by `@shared/utils/har-parse` (reading the file) and
 * `har-import` (mapping it onto `IData`/`IMock`); this component is the picker
 * around them. It exists because a HAR of one page load is hundreds of entries
 * and importing them silently would be useless: the user sees what survived the
 * filters, what was left out and why, and picks.
 *
 * The import itself goes through `importJSON`, the same function a `.json`
 * backup lands through, so there is one way to create requests, not two.
 */
@Component({
  standalone: false,
  selector: 'oh-my-har-import',
  templateUrl: './har-import.component.html',
  styleUrls: ['./har-import.component.scss']
})
export class HarImportComponent implements OnDestroy {
  dialogRef = inject<MatDialogRef<HarImportComponent>>(MatDialogRef, {
    optional: true
  });
  private appState = inject(AppStateService);
  private storeService = inject(OhMyState);
  private toast = inject(HotToastService);
  private cdr = inject(ChangeDetectorRef);

  phase: harImportPhase = 'pick';
  /** Set when a file could not be read or is not a HAR. Shown, never swallowed. */
  error?: string;

  fileName = '';
  parsed?: IOhMyHarParseSuccess;
  skips: IOhMyHarSkipSummary[] = [];

  rows: IOhMyHarRow[] = [];
  visibleRows: IOhMyHarRow[] = [];
  filter = '';

  /**
   * The domain the requests are stored under.
   *
   * Deliberately the *page's* host rather than the host of each call: mocks are
   * looked up by the domain of the tab the request came from
   * (`OhMyContentState.host`), so a call from `app.example.com` to
   * `api.example.com` has to be stored under `app.example.com` to ever be
   * found. It defaults to the domain the popup is showing, and the HAR's own
   * page host is offered next to it when the two differ.
   */
  targetDomain = '';
  suggestedDomain?: string;

  /**
   * Rows the user has toggled by hand, so recomputing the defaults (which
   * happens when the target domain changes) does not undo their choice.
   */
  private touched = new Set<string>();
  private isDestroyed = false;

  constructor() {
    this.targetDomain = this.appState.domain ?? '';
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
  }

  get selectedCount(): number {
    return this.rows.reduce(
      (count, row) => (row.selected ? count + 1 : count),
      0
    );
  }

  get skipSummary(): string {
    return this.skips.map((s) => `${s.count} ${s.label}`).join(', ');
  }

  /**
   * `ArrayLike<File>` rather than `FileList`: a `FileList` satisfies it, so the
   * uploader's output binds unchanged, and a test can hand in a plain array
   * instead of casting one into a type it cannot construct.
   */
  async onUploadFile(files: ArrayLike<File> | undefined): Promise<void> {
    const file = files?.[0];

    if (!file) {
      return;
    }

    this.fileName = file.name;
    this.error = undefined;

    try {
      await this.review(await this.readAsText(file));
    } catch (err) {
      // Reading can genuinely fail — a file that vanished, a permission the
      // browser withdrew. Saying so is the whole point.
      this.fail(`Could not read ${file.name}: ${errorMessage(err)}`);
    }
  }

  /** The list, narrowed by a substring of the method, path or host. */
  applyFilter(): void {
    const needle = this.filter.trim().toLowerCase();

    this.visibleRows = needle
      ? this.rows.filter(
          ({ candidate }) =>
            candidate.path.toLowerCase().includes(needle) ||
            candidate.host.toLowerCase().includes(needle) ||
            candidate.method.toLowerCase().includes(needle)
        )
      : this.rows;

    this.detectChanges();
  }

  onToggle(row: IOhMyHarRow): void {
    row.selected = !row.selected;
    this.touched.add(row.candidate.key);
    this.detectChanges();
  }

  /** Selects or clears everything the filter currently shows. */
  onSelectAll(selected: boolean): void {
    for (const row of this.visibleRows) {
      row.selected = selected;
      this.touched.add(row.candidate.key);
    }

    this.detectChanges();
  }

  async onDomainChange(domain: string): Promise<void> {
    this.targetDomain = domain;
    await this.refreshExisting();
  }

  useSuggestedDomain(): void {
    if (this.suggestedDomain) {
      void this.onDomainChange(this.suggestedDomain);
    }
  }

  async onImport(): Promise<void> {
    const picked = this.rows
      .filter((row) => row.selected)
      .map((row) => row.candidate);
    const domain = this.targetDomain.trim();

    if (!picked.length || !domain) {
      return;
    }

    this.phase = 'importing';
    this.detectChanges();

    try {
      // The preset of the *target* state, which need not be the one the popup
      // is showing: the imported requests are selected and enabled in it.
      const state = await this.storeService.getState({
        domain,
        preset: 'default'
      });
      const preset = state.context?.preset ?? 'default';

      const result = await importJSON(
        harCandidatesToBackup(picked, { preset, label: this.fileName }),
        { domain, preset, active: true }
      );

      if (result.status !== ImportResultEnum.SUCCESS) {
        this.phase = 'review';
        this.fail(`Import failed (${ImportResultEnum[result.status]})`);

        return;
      }

      this.toast.success(
        `Imported ${picked.length} request${picked.length === 1 ? '' : 's'} from ${this.fileName} into ${domain}`
      );

      if (domain !== this.appState.domain) {
        // Otherwise the import lands in a domain the user is not looking at.
        this.appState.domain = domain;
      }

      this.dialogRef?.close(picked.length);
    } catch (err) {
      this.phase = 'review';
      this.fail(`Import failed: ${errorMessage(err)}`);
    }
  }

  onCancel(): void {
    this.dialogRef?.close();
  }

  /** Back to the file picker, keeping the error visible. */
  onStartOver(): void {
    this.phase = 'pick';
    this.parsed = undefined;
    this.rows = [];
    this.visibleRows = [];
    this.touched.clear();
    this.detectChanges();
  }

  trackByKey(_index: number, row: IOhMyHarRow): string {
    return row.candidate.key;
  }

  /** Sizes as DevTools shows them, so a row is scannable for "this is the big one". */
  formatBytes(size: number): string {
    if (size < 1024) {
      return `${size} B`;
    }

    return size < 1024 * 1024
      ? `${(size / 1024).toFixed(1)} kB`
      : `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  private async review(text: string): Promise<void> {
    const result = parseHar(text);

    if (!result.ok) {
      this.fail(`${this.fileName}: ${result.error}`);

      return;
    }

    this.parsed = result;
    this.skips = summariseHarSkips(result.skipped);

    const candidates = groupHarEntries(result.entries);

    this.touched.clear();
    this.rows = candidates.map((candidate) => ({ candidate, selected: false }));

    if (!this.targetDomain && result.pageHost) {
      this.targetDomain = result.pageHost;
    }

    this.suggestedDomain =
      result.pageHost && result.pageHost !== this.targetDomain
        ? result.pageHost
        : undefined;

    this.phase = 'review';
    await this.refreshExisting();
  }

  /**
   * Marks the rows the target domain already has a request for.
   *
   * They are left unselected: `importJSON` does not deduplicate, so importing
   * one twice leaves two requests for one url and the lookup, which answers
   * with the first match, would pick between them arbitrarily.
   */
  private async refreshExisting(): Promise<void> {
    const domain = this.targetDomain.trim();
    const existing = domain
      ? await this.storeService.getRequests({ domain, preset: 'default' })
      : [];

    for (const row of this.rows) {
      row.existing = findExistingRequest(row.candidate, existing);

      if (!this.touched.has(row.candidate.key)) {
        // A response the file did not record would mock the call with an empty
        // body, which is rarely what is wanted — so it is offered, not assumed.
        row.selected = !row.existing && row.candidate.hasBody;
      }
    }

    this.applyFilter();
  }

  private fail(message: string): void {
    this.error = message;
    this.toast.error(message);
    this.detectChanges();
  }

  private readAsText(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error('unreadable'));
      reader.readAsText(file, 'UTF-8');
    });
  }

  private detectChanges(): void {
    if (!this.isDestroyed) {
      this.cdr.detectChanges();
    }
  }
}

/** Named for what it does, and *not* `describe` — Jest owns that word here. */
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
