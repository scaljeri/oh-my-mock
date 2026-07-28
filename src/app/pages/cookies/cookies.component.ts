import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { HotToastService } from '@ngxpert/hot-toast';
import { IOhMyContext, IOhMyCookie, IOhMyPresets, IState, ohMyCookieId } from '@shared/type';
import { combineLatest, Subscription } from 'rxjs';
import { IOhMyCookieToggle } from '../../components/cookie-list/cookie-list.component';
import { OhMyState } from '../../services/oh-my-store';
import { OhMyStateService } from '../../services/state.service';

/**
 * The Cookies tab: this domain's cookie mocks on the left, the selected one
 * open for editing on the right.
 *
 * Everything is written through `OhMyState`, which sends `payloadType.COOKIE`
 * to the background. The popup never writes `IState.cookies` — the handler
 * maintains that list, and doing it from here as well would race with it.
 */
@Component({
  standalone: false,
  selector: 'oh-my-cookies-page',
  templateUrl: './cookies.component.html',
  styleUrls: ['./cookies.component.scss']
})
export class PageCookiesComponent implements OnInit, OnDestroy {
  cookies: IOhMyCookie[] = [];
  context!: IOhMyContext;
  presets: IOhMyPresets = {};
  domain = '';
  filter = '';

  /** The mock open in the detail pane, if any. */
  selected?: IOhMyCookie;
  /** A new mock is being drafted; nothing is stored until it is saved. */
  isDrafting = false;

  private subscriptions = new Subscription();

  constructor(
    private stateService: OhMyStateService,
    private storeService: OhMyState,
    private toast: HotToastService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    // Both: the state holds the ids and the presets, the map holds the records,
    // and a change to either has to reach the list.
    this.subscriptions.add(combineLatest([this.stateService.state$, this.stateService.cookies$])
      .subscribe(([state, records]: [IState, Record<ohMyCookieId, IOhMyCookie>]) => {
        this.context = state.context;
        this.domain = state.domain;
        this.presets = state.presets;
        this.cookies = PageCookiesComponent.resolve(state, records);

        // The selection is held as the record itself, so it has to be picked up
        // again from the new list — and dropped when the mock is gone, which
        // happens when another popup or a reset removed it.
        const selectedId = this.selected?.id;

        if (selectedId) {
          this.selected = this.cookies.find(c => c.id === selectedId);
        }

        this.cdr.detectChanges();
      }));
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /** A state's cookie ids as records, skipping any that has not arrived yet. */
  static resolve(state: IState, records: Record<ohMyCookieId, IOhMyCookie>): IOhMyCookie[] {
    return (state.cookies ?? [])
      .map(id => records[id])
      .filter((cookie): cookie is IOhMyCookie => !!cookie);
  }

  get hasDetail(): boolean {
    return this.isDrafting || !!this.selected;
  }

  onSelect(id: ohMyCookieId): void {
    this.selected = this.cookies.find(c => c.id === id);
    this.isDrafting = false;
  }

  onNew(): void {
    this.selected = undefined;
    this.isDrafting = true;
  }

  onCancel(): void {
    this.isDrafting = false;
  }

  async onToggle({ cookie, enabled }: IOhMyCookieToggle): Promise<void> {
    await this.storeService.toggleCookie(cookie, enabled, this.context);
  }

  async onSave(cookie: Partial<IOhMyCookie>): Promise<void> {
    const saved = await this.storeService.upsertCookie(cookie, this.context);

    if (!saved) {
      this.toast.error('Could not save the cookie');

      return;
    }

    // The record comes back from the handler, so the pane can switch from
    // drafting to editing the stored mock without waiting for the storage
    // event that carries the same record a moment later.
    this.selected = saved;
    this.isDrafting = false;
    this.toast.success(`Saved ${saved.name}`, { duration: 2000 });
    this.cdr.detectChanges();
  }

  async onDelete(id: ohMyCookieId): Promise<void> {
    await this.storeService.deleteCookie(id, this.context);

    this.selected = undefined;
    this.isDrafting = false;
    this.toast.success('Deleted cookie', { duration: 2000 });
    this.cdr.detectChanges();
  }
}
