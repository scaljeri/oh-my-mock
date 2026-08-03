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
import { IOhMyContext, IOhMyMock, IState, ohMyDomain } from '@shared/type';
import { StateUtils } from '@shared/utils/state';
import { StorageUtils } from '@shared/utils/storage';
import { Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { AppStateService } from '../../services/app-state.service';
import { StorageService } from '../../services/storage.service';
import { OhMyState } from '../../services/oh-my-store';
import { HarImportComponent } from '../har-import/har-import.component';
import {
  DomainSummaryService,
  IOhMyDomainSummary
} from './domain-summary.service';
import { GroupListService, IOhMyGroupRow } from './group-list.service';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NavListComponent } from '../nav-list/nav-list.component';

/**
 * Several records are written in a row for a single user action (a state, a
 * request, a response). Counting once, shortly after the last of them, keeps
 * the sidebar from reading every domain three times per click.
 */
const REFRESH_DEBOUNCE = 200;

/**
 * The left column of the three-pane shell: a domain picker, and the mocks that
 * answer for the domain picked.
 *
 * Each row is a mock *group* in the code — a named set with a source — but the
 * word does not appear on screen. See the template.
 *
 * Neither list is in the store — it holds `domains: string[]` and `groups:
 * id[]`, no counts — so both are gathered per domain, by `DomainSummaryService`
 * and `GroupListService`, and re-gathered whenever anything writes to
 * `chrome.storage`. That listener is what makes a request captured by the
 * content script show up here without the popup being told about it.
 */
@Component({
  selector: 'oh-my-domain-sidebar',
  templateUrl: './domain-sidebar.component.html',
  styleUrls: ['./domain-sidebar.component.scss'],
  imports: [ReactiveFormsModule, FormsModule, NavListComponent]
})
export class DomainSidebarComponent implements OnInit, OnDestroy {
  private appState = inject(AppStateService);
  private storeService = inject(OhMyState);
  private summaryService = inject(DomainSummaryService);
  private groupListService = inject(GroupListService);
  private storageService = inject(StorageService);
  private cdr = inject(ChangeDetectorRef);
  private dialog = inject(MatDialog);

  /** The active domain's context — passed on to the overflow menu. */
  @Input() context!: IOhMyContext;
  @Output() navigate = new EventEmitter<void>();

  domains: IOhMyDomainSummary[] = [];
  activeDomain = '';
  /** The groups covering `activeDomain`, in the order that decides who answers. */
  groups: IOhMyGroupRow[] = [];

  /** The inline "add domain" form is only shown once the button is pressed. */
  isAdding = false;
  newDomain = '';

  @ViewChild('newDomainInput') newDomainInput?: ElementRef<HTMLInputElement>;

  private subscriptions = new Subscription();
  private isDestroyed = false;

  /**
   * Which group read is the current one.
   *
   * `refreshGroups` is several awaits long — the store, the state, then the
   * requests — so two of them overlap easily: toggling a group twice in quick
   * succession, or a storage write arriving while a domain switch is still
   * resolving. Without this, the slower read finishes last and puts its older
   * answer on screen, and the sidebar then disagrees with what is stored until
   * something else happens to redraw it.
   */
  private groupReadId = 0;

  ngOnInit(): void {
    this.subscriptions.add(
      this.appState.domain$.subscribe((domain) => {
        this.activeDomain = domain ?? '';
        this.detectChanges();
        // The group list is per domain, so switching domain changes it — and
        // nothing writes to storage on a switch, so the listener below will
        // not fire for it.
        void this.refreshGroups();
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
    this.detectChanges();

    await this.refreshGroups(store);
  }

  /**
   * Re-reads the groups covering the domain on screen.
   *
   * Separate from `refresh` because switching domain changes this list without
   * writing anything, and `refresh` is driven by storage writes.
   */
  async refreshGroups(store?: IOhMyMock): Promise<void> {
    const read = ++this.groupReadId;

    if (!this.activeDomain) {
      this.groups = [];
      this.detectChanges();

      return;
    }

    const resolved = store ?? (await this.storeService.getStore());
    // Typed as always resolving a state, but `chrome.storage` resolves
    // `undefined` for a key it does not hold.
    const state: IState | undefined = await this.storageService.get<IState>(
      this.activeDomain
    );
    const rows = await this.groupListService.rowsFor(resolved, state);

    // A newer read started while this one was waiting: drop this answer rather
    // than let it overwrite the fresher one.
    if (read !== this.groupReadId) {
      return;
    }

    this.groups = rows;
    this.detectChanges();
  }

  /**
   * Switches a group on or off **for this domain**.
   *
   * The group itself is untouched: what is written is the domain's list of
   * exceptions, so the same group keeps answering on the other domains it
   * covers.
   */
  async onToggleGroup(row: IOhMyGroupRow): Promise<void> {
    const state: IState | undefined = await this.storageService.get<IState>(
      this.activeDomain
    );

    if (!state) {
      return;
    }

    const disabledGroups = GroupListService.toggled(
      state,
      row.group.id,
      !row.enabled
    );

    await this.storeService.updateAux({ disabledGroups }, this.context);
    await this.refreshGroups();
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

  trackByGroup(_index: number, row: IOhMyGroupRow): string {
    return row.group.id;
  }

  private detectChanges(): void {
    if (!this.isDestroyed) {
      this.cdr.detectChanges();
    }
  }
}
