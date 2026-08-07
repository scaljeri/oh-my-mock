import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  inject
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray
} from '@angular/cdk/drag-drop';
import { IOhMyContext, IOhMyMock, IState, ohMyGroupId } from '@shared/type';
import { StorageUtils } from '@shared/utils/storage';
import { Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { AppStateService } from '../../services/app-state.service';
import { StorageService } from '../../services/storage.service';
import { OhMyState } from '../../services/oh-my-store';
import { HarImportComponent } from '../har-import/har-import.component';
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
 * The left column of the three-pane shell: the mocks answering for the domain
 * being looked at.
 *
 * Which domain that is comes from the active tab, not from here — adding and
 * forgetting domains lives on `/domains`. Each row is a mock *group* in the
 * code, a named set with a source, but the word does not appear on screen.
 *
 * The rows are not in the store — it holds `groups: id[]`, no counts — so they
 * are gathered by `GroupListService` and re-gathered whenever anything writes
 * to `chrome.storage`. That listener is what makes a request captured by the
 * content script show up here without the popup being told about it.
 */
@Component({
  selector: 'oh-my-domain-sidebar',
  templateUrl: './domain-sidebar.component.html',
  styleUrls: ['./domain-sidebar.component.scss'],
  imports: [
    ReactiveFormsModule,
    FormsModule,
    NavListComponent,
    CdkDropList,
    CdkDrag,
    CdkDragHandle
  ]
})
export class DomainSidebarComponent implements OnInit, OnDestroy {
  private appState = inject(AppStateService);
  private storeService = inject(OhMyState);
  private groupListService = inject(GroupListService);
  private storageService = inject(StorageService);
  private cdr = inject(ChangeDetectorRef);
  private dialog = inject(MatDialog);

  /** The active domain's context — passed on to the overflow menu. */
  @Input() context!: IOhMyContext;
  @Output() navigate = new EventEmitter<void>();

  activeDomain = '';
  /** The groups covering `activeDomain`, in the order that decides who answers. */
  groups: IOhMyGroupRow[] = [];

  /**
   * Which of the three inline forms is open, and on which row.
   *
   * Inline rather than dialogs, following the drawer's own idiom: naming a set
   * of mocks is a two-second act and a modal over a 380px popup hides the list
   * being changed. Only one can be open at a time — `openRenameOn` and
   * `openDeleteOn` clear each other — so a row is never two things at once.
   */
  isCreating = false;
  newName = '';
  renamingId: ohMyGroupId | null = null;
  renameName = '';
  deletingId: ohMyGroupId | null = null;

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
        // A rename half-typed on the previous domain's group would otherwise
        // still be open, over a row that is now somebody else's.
        this.closeForms();
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

  /** Re-reads the mocks answering for this domain. */
  async refresh(): Promise<void> {
    await this.refreshGroups(await this.storeService.getStore());
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

  /** Opens the "new group" field, closing whatever else was open. */
  openCreate(): void {
    this.closeForms();
    this.isCreating = true;
    this.newName = '';
    this.detectChanges();
  }

  /**
   * Creates a group holding nothing, covering the domain on screen.
   *
   * The name is all that is sent. The id and the place in the store's group
   * list are the background's — see `OhMyState.createGroup`.
   */
  async onCreate(): Promise<void> {
    const name = this.newName.trim();

    // An empty name would make a row nobody can tell apart from another empty
    // one, and the handler refuses it anyway. Keeping the field open says so
    // more clearly than closing it and doing nothing.
    if (!name) {
      return;
    }

    this.closeForms();
    await this.storeService.createGroup(name, this.context);
    await this.refreshGroups();
  }

  /** Opens the rename field on one row. */
  openRenameOn(row: IOhMyGroupRow): void {
    this.closeForms();
    this.renamingId = row.group.id;
    this.renameName = row.group.name;
    this.detectChanges();
  }

  /**
   * Renames a group.
   *
   * The domain's own group is renameable like any other: its identity is the
   * derived id, so the name is only ever a label — "My mocks" is where it
   * starts, not what it is.
   */
  async onRename(row: IOhMyGroupRow): Promise<void> {
    const name = this.renameName.trim();

    if (!name || name === row.group.name) {
      this.closeForms();
      this.detectChanges();

      return;
    }

    this.closeForms();
    await this.storeService.renameGroup(row.group.id, name, this.context);
    await this.refreshGroups();
  }

  /**
   * Opens the delete confirmation on one row.
   *
   * The domain's own group opens it too, and gets the refusal instead of the
   * question. Hiding or disabling the button would leave someone clicking at
   * nothing and guessing why; this answers.
   */
  openDeleteOn(row: IOhMyGroupRow): void {
    this.closeForms();
    this.deletingId = row.group.id;
    this.detectChanges();
  }

  /**
   * Deletes a group and the mocks tagged with it.
   *
   * The confirmation says how many, because they are not moved anywhere — a
   * request whose group is gone is served by nobody and drawn by nobody, so
   * keeping the records would lose them rather than save them. See
   * `OhMyGroupHandler.remove` for why re-tagging them to this domain's own
   * group was rejected.
   */
  async onDelete(row: IOhMyGroupRow): Promise<void> {
    // The handler refuses it as well. Both, because the handler is the rule and
    // this is the only place anyone can see it being applied.
    if (row.isOwn) {
      return;
    }

    this.closeForms();
    await this.storeService.deleteGroup(row.group.id, this.context);
    await this.refreshGroups();
  }

  /** Shuts every inline form; what was typed into them is dropped. */
  closeForms(): void {
    this.isCreating = false;
    this.newName = '';
    this.renamingId = null;
    this.renameName = '';
    this.deletingId = null;
  }

  /** `closeForms` from the template, which has to redraw afterwards. */
  onCancel(): void {
    this.closeForms();
    this.detectChanges();
  }

  /**
   * Reorders the list by dragging.
   *
   * The order is **global** — a position in `IOhMyMock.groups`, not something
   * per domain — while switching a group off next to it is per domain. The two
   * live in one row because that is where both decisions are made, but only one
   * of them travels to the store record.
   */
  async onDrop(event: CdkDragDrop<IOhMyGroupRow[]>): Promise<void> {
    if (event.previousIndex === event.currentIndex) {
      return;
    }

    await this.moveTo(event.previousIndex, event.currentIndex);
  }

  /**
   * The same move from the keyboard.
   *
   * The CDK's drag is pointer-only: it listens for `mousedown`/`touchstart` and
   * offers no keyboard equivalent, so a drawer with nothing but a grip is a
   * drawer where the serving order cannot be changed without a mouse. The arrow
   * keys go through the identical path — one message, one move — rather than a
   * second way of writing the order.
   */
  async onReorderKey(event: KeyboardEvent, index: number): Promise<void> {
    const step = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
    const to = index + step;

    if (!step || to < 0 || to >= this.groups.length) {
      return;
    }

    // Before the await: the arrow keys scroll the drawer otherwise, and the row
    // being moved is dragged out from under the caret.
    event.preventDefault();

    await this.moveTo(index, to);
  }

  /**
   * Moves the row at `from` to `to`, and tells the store which group it should
   * now follow.
   *
   * The list on screen is moved first so the row stays where it was dropped
   * while the write is in flight — the CDK returns the element to its original
   * slot the moment the drop finishes, and a round trip through the service
   * worker is long enough to watch it snap back.
   *
   * What is sent is the **neighbour**, not the index. An index is a position in
   * the list this popup happens to be showing; a group created or deleted in
   * the background moves every index after it, and the reorder would land
   * somewhere nobody asked for. The group above it is the same group whatever
   * else the list has gained or lost — and when there is none, `null` says
   * "first" without naming a length.
   */
  private async moveTo(from: number, to: number): Promise<void> {
    const moved = this.groups[from];

    moveItemInArray(this.groups, from, to);
    this.detectChanges();

    const after: ohMyGroupId | null =
      to === 0 ? null : this.groups[to - 1].group.id;

    await this.storeService.moveGroup(moved.group.id, after, this.activeDomain);
    // Re-read rather than trust the optimistic move: the background refuses a
    // move whose neighbour has been deleted since the drawer drew it, and the
    // list has to go back to what is stored when it does.
    await this.refreshGroups();
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

  trackByGroup(_index: number, row: IOhMyGroupRow): string {
    return row.group.id;
  }

  private detectChanges(): void {
    if (!this.isDestroyed) {
      this.cdr.detectChanges();
    }
  }
}
