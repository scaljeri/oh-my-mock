import { Component, Input, OnChanges, OnInit, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import {
  IData,
  IOhMyContext,
  IOhMyShallowMock,
  IUpsertMock,
  ohMyMockId,
  ohMyStatusCode
} from '@shared/type';
import { CreateStatusCodeComponent } from '../../../components/create-response/create-status-code.component';
import { UntypedFormControl, ReactiveFormsModule } from '@angular/forms';
import { METHODS } from '@shared/constants';
import { UntilDestroy } from '@ngneat/until-destroy';
import { Subscription } from 'rxjs';
import { OhMyState } from '../../../services/oh-my-store';
import { activeMockId } from '../active-mock';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { Router } from '@angular/router';
import { HotToastService } from '@ngxpert/hot-toast';
import { LowerCasePipe, DatePipe } from '@angular/common';
import { StatusCodeTonePipe } from '../../../pipes/status-code-tone.pipe';

/**
 * One saved response, as the chip row renders it.
 *
 * The template only reads these fields; deciding which of them is selected, and
 * in what order they appear, happens in `ngOnChanges` so it can be tested.
 */
export interface IOhMyResponseChip {
  id: ohMyMockId;
  statusCode: ohMyStatusCode;
  label: string;
  isSelected: boolean;
}

@UntilDestroy({ arrayName: 'subscriptions' })
@Component({
  selector: 'oh-my-request-header',
  templateUrl: './request-header.component.html',
  styleUrls: ['./request-header.component.scss'],
  imports: [
    MatIcon,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    ReactiveFormsModule,
    LowerCasePipe,
    DatePipe,
    StatusCodeTonePipe
  ]
})
export class RequestHeaderComponent implements OnInit, OnChanges {
  dialog = inject(MatDialog);
  private storeService = inject(OhMyState);
  private router = inject(Router);
  private toast = inject(HotToastService);

  @Input() request!: IData;
  @Input() context!: IOhMyContext;

  public mockIds: ohMyMockId[] = [];
  public chips: IOhMyResponseChip[] = [];

  /** True when this request serves no mock at all in the active preset. */
  public isPassthrough = true;

  public methodCtrl = new UntypedFormControl(null, { updateOn: 'blur' });
  // A `<select>` never has a pending value, so it commits on change; the two
  // free-text fields wait for blur so every keystroke is not a store write.
  public typeCtrl = new UntypedFormControl(null, { updateOn: 'change' });
  public urlCtrl = new UntypedFormControl(null, { updateOn: 'blur' });

  /**
   * The design shows the method and url as a read-only line. They stay
   * editable — a hand-added request is created with a placeholder url — behind
   * a toggle on that line, rather than as three permanently visible inputs.
   */
  public isEditing = false;

  public availableMethods = METHODS;
  public requestTypes: ReadonlyArray<string> = ['FETCH', 'XHR'];

  // Read by `@UntilDestroy({ arrayName: 'subscriptions' })`.
  subscriptions: Subscription[] = [];

  ngOnInit(): void {
    this.subscriptions.push(
      this.methodCtrl.valueChanges.subscribe((val) => {
        const method = (val || '').toUpperCase();
        if (method !== this.request.method) {
          this.storeService.upsertRequest(
            {
              id: this.request.id,
              method
            },
            this.context
          );
        }
      })
    );

    this.subscriptions.push(
      this.typeCtrl.valueChanges.subscribe((type) => {
        if (type !== this.request.requestType) {
          this.storeService.upsertRequest(
            {
              id: this.request.id,
              requestType: type
            },
            this.context
          );
        }
      })
    );

    this.subscriptions.push(
      this.urlCtrl.valueChanges.subscribe((url) => {
        if (url !== this.request.url) {
          this.storeService.upsertRequest(
            {
              id: this.request.id,
              url: url,
              // A hand-edited url is the one to show. `displayUrl` only exists
              // where an import had to store a pattern; keeping the old one
              // would label this request with a url it no longer matches.
              displayUrl: ''
            },
            this.context
          );
        }
      })
    );
  }

  ngOnChanges(): void {
    this.mockIds = RequestHeaderComponent.sortMockIds(this.request?.mocks);
    this.chips = this.buildChips();
    this.isPassthrough = !this.activeMockId;

    this.methodCtrl.setValue(this.request?.method);
    this.typeCtrl.setValue(this.request?.requestType);
    this.urlCtrl.setValue(this.request?.url);
  }

  /** Saved responses read best in status-code order, lowest first. */
  static sortMockIds(
    mocks: Record<ohMyMockId, IOhMyShallowMock> | undefined
  ): ohMyMockId[] {
    if (!mocks) {
      return [];
    }

    return Object.keys(mocks).sort((a, b) => {
      const ma = mocks[a];
      const mb = mocks[b];

      return ma.statusCode === mb.statusCode
        ? 0
        : ma.statusCode > mb.statusCode
          ? 1
          : -1;
    });
  }

  /**
   * The response served right now, or undefined when the "Off" chip is the
   * selected one. See `active-mock.ts` for what has to line up.
   */
  get activeMockId(): ohMyMockId | undefined {
    return activeMockId(this.request, this.context);
  }

  /** "no responses" / "1 response" / "4 responses", for the metadata line. */
  get responseCountLabel(): string {
    const count = this.mockIds.length;

    if (count === 0) {
      return 'no responses';
    }

    return count === 1 ? '1 response' : `${count} responses`;
  }

  private buildChips(): IOhMyResponseChip[] {
    const mocks = this.request?.mocks;

    if (!mocks) {
      return [];
    }

    const active = this.activeMockId;

    return this.mockIds.map((id) => ({
      id,
      statusCode: mocks[id].statusCode,
      label: mocks[id].label ?? '',
      isSelected: id === active
    }));
  }

  onToggleEdit(): void {
    this.isEditing = !this.isEditing;
  }

  onSelectStatusCode(mockId: ohMyMockId): void {
    const enabled = { ...this.request.enabled, [this.context.preset]: true };
    const selected = {
      ...this.request.selected,
      [this.context.preset]: mockId
    };

    this.storeService.upsertRequest(
      { ...this.request, enabled, selected },
      this.context
    );
  }

  onDisableRequest(): void {
    const enabled = { ...this.request.enabled, [this.context.preset]: false };
    this.storeService.upsertRequest({ ...this.request, enabled }, this.context);
  }

  /** Copies the response on display into a new one, so it can be edited apart. */
  onCloneResponse(): void {
    const id = this.activeMockId;

    if (!id) {
      return;
    }

    const source = this.request.mocks[id];

    this.storeService.cloneResponse(
      id,
      {
        statusCode: source.statusCode,
        label: source.label ? `${source.label} (copy)` : 'copy'
      },
      this.request,
      this.context
    );
  }

  /**
   * Names the response the button removes, rather than saying "the response on
   * display".
   *
   * A request can hold several responses that differ only by status code, and
   * the button sits next to a row of chips — so which one it is about is the
   * whole question. Falls back to the generic wording in passthrough, where the
   * button is disabled and there is nothing to name.
   */
  get deleteResponseLabel(): string {
    const id = this.activeMockId;
    const mock = id ? this.request.mocks?.[id] : undefined;

    if (!mock) {
      return 'Delete the response on display';
    }

    return mock.label
      ? `Delete the ${mock.statusCode} "${mock.label}" response`
      : `Delete the ${mock.statusCode} response`;
  }

  onDeleteResponse(): void {
    const id = this.activeMockId;

    if (!id) {
      return;
    }

    const mock = this.request.mocks?.[id];

    this.storeService.deleteResponse(id, this.request.id, this.context);
    this.toast.success(`Deleted the ${mock?.statusCode ?? ''} response`.trim(), {
      duration: 2000
    });
  }

  /**
   * Deletes the whole request — the endpoint and every response under it.
   *
   * Then navigates back to the list, which is not optional: this pane is a
   * routed child keyed on `:dataId`, and `PageMockComponent` resolves that id to
   * `undefined` once the record is gone. Staying put would leave the panel
   * overlaying the list with nothing in it.
   *
   * The list's own delete button would be the other home for this, but it is one
   * of three icons crammed into a 44px cell and only the first of them is ever
   * laid out — so in practice this is the only place the action exists.
   */
  /** Copies the endpoint and every response under it into a new request. */
  onCloneRequest(): void {
    // `cloneRequest` takes a source context for the state explorer, which clones
    // across domains; here both sides are this domain.
    void this.storeService.cloneRequest(
      this.request.id,
      this.context,
      this.context
    );
    this.toast.success(`Duplicated ${this.request.url}`, { duration: 2000 });
  }

  onDeleteRequest(): void {
    const url = this.request.url;

    this.storeService.deleteRequest(this.request, this.context);
    this.toast.success(`Deleted ${url}`, { duration: 2000 });

    void this.router.navigate(['/']);
  }

  openAddResponseDialog(): void {
    // Width only. The fixed 380px height predates the redesign's type scale:
    // the status code field, the label field, the clone toggle and the actions
    // no longer fit, so the dialog grew its own scrollbar and the autocomplete
    // panel covered the buttons.
    const dialogRef = this.dialog.open(CreateStatusCodeComponent, {
      width: '360px'
    });

    dialogRef.afterClosed().subscribe(async (update: IUpsertMock) => {
      if (!update) {
        return;
      }

      if (update.clone) {
        this.storeService.cloneResponse(
          this.request.selected[this.context.preset],
          update.mock,
          this.request,
          this.context
        );
      } else {
        this.storeService.upsertResponse(
          update.mock,
          this.request,
          this.context
        );
      }
    });
  }
}
