import { Component, Input, OnChanges, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { IData, IOhMyContext, IOhMyShallowMock, IUpsertMock, ohMyMockId, ohMyStatusCode } from '@shared/type';
import { CreateStatusCodeComponent } from '../../../components/create-response/create-status-code.component';
import { UntypedFormControl } from '@angular/forms';
import { METHODS } from '@shared/constants';
import { UntilDestroy } from '@ngneat/until-destroy';
import { Subscription } from 'rxjs';
import { OhMyState } from '../../../services/oh-my-store';
import { activeMockId } from '../active-mock';

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
  standalone: false,
  selector: 'oh-my-request-header',
  templateUrl: './request-header.component.html',
  styleUrls: ['./request-header.component.scss']
})
export class RequestHeaderComponent implements OnInit, OnChanges {
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

  constructor(
    public dialog: MatDialog,
    private storeService: OhMyState) { }

  ngOnInit(): void {
    this.subscriptions.push(this.methodCtrl.valueChanges.subscribe(val => {
      const method = (val || '').toUpperCase();
      if (method !== this.request.method) {
        this.storeService.upsertRequest({
          id: this.request.id, method
        }, this.context)
      }
    }));

    this.subscriptions.push(this.typeCtrl.valueChanges.subscribe(type => {
      if (type !== this.request.requestType) {
        this.storeService.upsertRequest({
          id: this.request.id, requestType: type
        }, this.context)
      }
    }));

    this.subscriptions.push(this.urlCtrl.valueChanges.subscribe(url => {
      if (url !== this.request.url) {
        this.storeService.upsertRequest({
          id: this.request.id, url: url
        }, this.context)
      }
    }));
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
  static sortMockIds(mocks: Record<ohMyMockId, IOhMyShallowMock> | undefined): ohMyMockId[] {
    if (!mocks) {
      return [];
    }

    return Object.keys(mocks).sort((a, b) => {
      const ma = mocks[a];
      const mb = mocks[b];

      return ma.statusCode === mb.statusCode ? 0 : ma.statusCode > mb.statusCode ? 1 : -1;
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

    return this.mockIds.map(id => ({
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
    const selected = { ...this.request.selected, [this.context.preset]: mockId };

    this.storeService.upsertRequest({ ...this.request, enabled, selected }, this.context);
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

    this.storeService.cloneResponse(id, {
      statusCode: source.statusCode,
      label: source.label ? `${source.label} (copy)` : 'copy'
    }, this.request, this.context);
  }

  onDeleteResponse(): void {
    const id = this.activeMockId;

    if (!id) {
      return;
    }

    this.storeService.deleteResponse(id, this.request.id, this.context);
  }

  openAddResponseDialog(): void {
    const dialogRef = this.dialog.open(CreateStatusCodeComponent, {
      width: '280px',
      height: '380px'
    });

    dialogRef.afterClosed().subscribe(async (update: IUpsertMock) => {
      if (!update) {
        return;
      }

      if (update.clone) {
        this.storeService.cloneResponse(
          this.request.selected[this.context.preset],
          update.mock, this.request, this.context);
      } else {
        this.storeService.upsertResponse(update.mock, this.request, this.context);
      }
    });
  }
}
