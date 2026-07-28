import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  inject
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { IOhMyContext, IOhMyMock, ohMyDomain } from '@shared/type';
import { StateUtils } from '@shared/utils/state';
import { StorageUtils } from '@shared/utils/storage';
import { Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { AppStateService } from '../../services/app-state.service';
import { OhMyState } from '../../services/oh-my-store';
import { HarImportComponent } from '../har-import/har-import.component';
import {
  DomainSummaryService,
  IOhMyDomainSummary
} from './domain-summary.service';

/**
 * Several records are written in a row for a single user action (a state, a
 * request, a response). Counting once, shortly after the last of them, keeps
 * the sidebar from reading every domain three times per click.
 */
const REFRESH_DEBOUNCE = 200;

/**
 * The left column of the three-pane shell: search, the domains OhMyMock knows
 * about with their counts, and the actions that create new ones. See the
 * `aside` in `design/Mock Manager v2.dc.html`.
 *
 * The counts are not in the store — it only holds `domains: string[]` — so
 * they are gathered per domain by `DomainSummaryService`, and re-gathered
 * whenever anything writes to `chrome.storage`. That listener is what makes a
 * request captured by the content script show up here without the popup being
 * told about it.
 */
@Component({
  standalone: false,
  selector: 'oh-my-domain-sidebar',
  templateUrl: './domain-sidebar.component.html',
  styleUrls: ['./domain-sidebar.component.scss']
})
export class DomainSidebarComponent implements OnInit, OnDestroy {
  private appState = inject(AppStateService);
  private storeService = inject(OhMyState);
  private summaryService = inject(DomainSummaryService);
  private cdr = inject(ChangeDetectorRef);
  private dialog = inject(MatDialog);

  /** The active domain's context — passed on to the overflow menu. */
  @Input() context!: IOhMyContext;
  @Output() navigate = new EventEmitter<void>();

  filter = '';
  domains: IOhMyDomainSummary[] = [];
  visibleDomains: IOhMyDomainSummary[] = [];
  activeDomain = '';

  /** The inline "add domain" form is only shown once the button is pressed. */
  isAdding = false;
  newDomain = '';

  @ViewChild('newDomainInput') newDomainInput?: ElementRef<HTMLInputElement>;

  private subscriptions = new Subscription();
  private isDestroyed = false;

  ngOnInit(): void {
    this.subscriptions.add(
      this.appState.domain$.subscribe((domain) => {
        this.activeDomain = domain ?? '';
        this.detectChanges();
      })
    );

    this.subscriptions.add(
      StorageUtils.updates$
        .pipe(debounceTime(REFRESH_DEBOUNCE))
        .subscribe(() => void this.refresh())
    );

    void this.refresh();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.subscriptions.unsubscribe();
  }

  /** Re-reads the domain list and its counts. */
  async refresh(): Promise<void> {
    const store: IOhMyMock | undefined = await this.storeService.getStore();

    this.domains = await this.summaryService.summariseAll(store?.domains ?? []);
    this.applyFilter();
  }

  applyFilter(): void {
    const needle = this.filter.trim().toLowerCase();

    this.visibleDomains = needle
      ? this.domains.filter((d) => d.domain.toLowerCase().includes(needle))
      : this.domains;

    this.detectChanges();
  }

  onSelect(domain: ohMyDomain): void {
    if (domain !== this.activeDomain) {
      // The shell listens on this: it re-initialises the state and the search
      // worker for the new domain and routes back to the request list.
      this.appState.domain = domain;
    }

    this.navigate.emit();
  }

  onStartAdd(): void {
    this.isAdding = true;
    this.newDomain = '';
    this.detectChanges();
    // After the form exists, not before.
    setTimeout(() => this.newDomainInput?.nativeElement.focus());
  }

  onCancelAdd(): void {
    this.isAdding = false;
    this.newDomain = '';
    this.detectChanges();
  }

  /**
   * Writes an empty state for the domain, which is what puts it in the store's
   * domain list, and switches to it.
   */
  async onAddDomain(): Promise<void> {
    const domain = this.newDomain.trim();

    if (!domain) {
      return;
    }

    await this.storeService.upsertState(StateUtils.init({ domain }));

    this.isAdding = false;
    this.newDomain = '';

    await this.refresh();
    this.onSelect(domain);
  }

  /**
   * Opens the HAR picker.
   *
   * It may import into a domain this list does not have yet — the file names
   * the host it was recorded on — so the counts are re-read once it closes
   * rather than waiting for the debounced storage listener.
   */
  onImportHar(): void {
    this.dialog
      .open(HarImportComponent, { width: '760px', maxWidth: '92vw', data: {} })
      .afterClosed()
      .subscribe(() => void this.refresh());
  }

  trackByDomain(_index: number, summary: IOhMyDomainSummary): string {
    return summary.domain;
  }

  private detectChanges(): void {
    if (!this.isDestroyed) {
      this.cdr.detectChanges();
    }
  }
}
