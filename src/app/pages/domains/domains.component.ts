import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIcon } from '@angular/material/icon';
import { IOhMyMock, ohMyDomain } from '@shared/type';
import { StateUtils } from '@shared/utils/state';
import { StorageUtils } from '@shared/utils/storage';
import { Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import {
  DomainSummaryService,
  IOhMyDomainSummary
} from '../../components/domain-sidebar/domain-summary.service';
import { AppStateService } from '../../services/app-state.service';
import { OhMyState } from '../../services/oh-my-store';

/** See `DomainSidebarComponent` — several records land per user action. */
const REFRESH_DEBOUNCE = 200;

/**
 * Managing the domains OhMyMock knows about: what is stored for each, adding
 * one, and forgetting one.
 *
 * A page rather than part of the sidebar, because picking a domain is not a
 * thing anyone does: **the url in the active tab decides which domain is being
 * looked at**. The sidebar showing a picker suggested otherwise, and spent its
 * width on navigation that never happens. What is left over is genuine
 * housekeeping — a domain typed in ahead of visiting it, one left behind by a
 * HAR import — and that belongs somewhere you go on purpose.
 */
@Component({
  selector: 'oh-my-domains',
  templateUrl: './domains.component.html',
  styleUrls: ['./domains.component.scss'],
  imports: [FormsModule, MatIcon]
})
export class DomainsComponent implements OnInit, OnDestroy {
  private appState = inject(AppStateService);
  private storeService = inject(OhMyState);
  private summaryService = inject(DomainSummaryService);
  private cdr = inject(ChangeDetectorRef);

  domains: IOhMyDomainSummary[] = [];
  /** The domain of the tab the popup was opened on — not a selection. */
  activeDomain = '';

  newDomain = '';
  /** The domain awaiting a second click before it is forgotten. */
  confirming?: ohMyDomain;

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

  async refresh(): Promise<void> {
    const store: IOhMyMock | undefined = await this.storeService.getStore();

    this.domains = await this.summaryService.summariseAll(store?.domains ?? []);
    this.detectChanges();
  }

  /**
   * Writes an empty state, which is what puts the domain in the store's list.
   *
   * It does not switch to it: which domain is on screen follows the tab.
   */
  async onAdd(): Promise<void> {
    const domain = this.newDomain.trim();

    if (!domain) {
      return;
    }

    await this.storeService.upsertState(StateUtils.init({ domain }));

    this.newDomain = '';
    await this.refresh();
    this.newDomainInput?.nativeElement.focus();
  }

  /**
   * Forgetting a domain takes two clicks.
   *
   * There is no undo — the mocks, the requests and the responses all go — and a
   * delete sitting one click away in a list is the kind of button that gets
   * pressed on the wrong row.
   */
  onDelete(domain: ohMyDomain): void {
    this.confirming = this.confirming === domain ? undefined : domain;
    this.detectChanges();
  }

  onCancelDelete(): void {
    this.confirming = undefined;
    this.detectChanges();
  }

  async onConfirmDelete(domain: ohMyDomain): Promise<void> {
    this.confirming = undefined;

    await this.storeService.deleteDomain(domain);
    await this.refresh();
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
