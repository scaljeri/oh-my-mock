import {
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  inject
} from '@angular/core';
import { UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { IMock, IOhMyContext } from '@shared/type';
import { Subscription } from 'rxjs';
import { strip, update as updateContentType } from '@shared/utils/mime-type';
import { OhMyState } from '../../../services/oh-my-store';

/** The suggestions behind the status code field. */
export const STATUS_CODE_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
}> = [
  { value: '200', label: '200 OK' },
  { value: '201', label: '201 Created' },
  { value: '204', label: '204 No Content' },
  { value: '304', label: '304 Not Modified' },
  { value: '400', label: '400 Bad Request' },
  { value: '401', label: '401 Unauthorized' },
  { value: '403', label: '403 Forbidden' },
  { value: '404', label: '404 Not Found' },
  { value: '500', label: '500 Internal Server Error' },
  { value: '501', label: '501 Not Implemented' },
  { value: '503', label: '503 Service Unavailable' }
];

/** The suggestions behind the content type field. */
export const MIME_TYPE_OPTIONS: ReadonlyArray<string> = [
  'application/json',
  'text/css',
  'text/csv',
  'text/html',
  'text/javascript',
  'text/plain',
  'image/svg+xml'
];

/**
 * The four response settings in the detail pane: status code, delay, content
 * type and label.
 *
 * The design draws these as four plain inputs in a 2x2 grid, so this no longer
 * goes through `oh-my-status-code` / `oh-my-content-type` — both wrap a
 * Material form field, which cannot be made to look like the mockup's inputs
 * without fighting its overlays. The two things those components did that a
 * bare input does not — coercing a typed status code to a number, and keeping
 * the `charset` part of a content-type header intact — moved here as
 * `parseStatusCode` and `mergeContentType`, which are unit tested.
 *
 * `oh-my-content-type` was deleted with this change: it had no callers left.
 * `oh-my-status-code` stays, the create-response dialog still uses it.
 */
@Component({
  standalone: false,
  selector: 'oh-my-mock-details',
  templateUrl: './mock-details.component.html',
  styleUrls: ['./mock-details.component.scss']
})
export class MockDetailsComponent implements OnInit, OnChanges, OnDestroy {
  private storeService = inject(OhMyState);
  private cdr = inject(ChangeDetectorRef);

  @Input() response!: IMock;
  @Input() requestId!: string;
  @Input() context!: IOhMyContext;

  private subscriptions = new Subscription();
  form!: UntypedFormGroup;

  statusCodeOptions = STATUS_CODE_OPTIONS;
  mimeTypes = MIME_TYPE_OPTIONS;

  ngOnInit(): void {
    this.form = new UntypedFormGroup({
      delay: new UntypedFormControl(this.response.delay ?? '', {
        updateOn: 'blur'
      }),
      statusCode: new UntypedFormControl(this.response.statusCode, {
        updateOn: 'blur'
      }),
      label: new UntypedFormControl(this.response.label ?? '', {
        updateOn: 'blur'
      }),
      contentType: new UntypedFormControl(
        strip(this.response.headersMock?.['content-type']),
        { updateOn: 'blur' }
      )
    });

    this.subscriptions.add(
      this.form.valueChanges.subscribe(() => this.persist())
    );
  }

  ngOnChanges(): void {
    if (!this.form) {
      return;
    }

    const options = { emitEvent: false, onlySelf: true };

    this.delayCtrl.setValue(this.response.delay ?? '', options);
    this.statusCodeCtrl.setValue(this.response.statusCode, options);
    this.contentTypeCtrl.setValue(
      strip(this.response.headersMock?.['content-type']),
      options
    );
    this.labelCtrl.setValue(this.response.label ?? '', options);
  }

  /**
   * A typed status code, or null when the field says nothing usable.
   *
   * Anything after the digits is dropped, so picking "404 Not Found" out of the
   * suggestion list stores 404. Null means "leave the stored code alone" — an
   * emptied field must not wipe a working mock.
   */
  parseStatusCode(raw: unknown): number | null {
    const digits = String(raw ?? '').match(/\d+/)?.[0];

    return digits ? Number(digits) : null;
  }

  /** A delay in ms, or undefined when the field is empty or not a number. */
  parseDelay(raw: unknown): number | undefined {
    const value = String(raw ?? '').trim();

    if (value === '') {
      return undefined;
    }

    const parsed = Number(value);

    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  }

  /**
   * Puts a picked mime type back into the stored `content-type` header without
   * losing what followed it — `; charset=utf-8` and friends.
   */
  mergeContentType(stored: string | undefined, picked: unknown): string {
    return updateContentType(stored ?? '', String(picked ?? ''));
  }

  private persist(): void {
    const statusCode = this.parseStatusCode(this.statusCodeCtrl.value);

    this.storeService.upsertResponse(
      {
        id: this.response.id,
        ...(statusCode !== null && { statusCode }),
        delay: this.parseDelay(this.delayCtrl.value),
        label: this.labelCtrl.value,
        headersMock: {
          ...this.response.headersMock,
          'content-type': this.mergeContentType(
            this.response.headersMock?.['content-type'],
            this.contentTypeCtrl.value
          )
        }
      },
      { id: this.requestId },
      this.context
    );

    this.cdr.detectChanges();
  }

  get labelCtrl(): UntypedFormControl {
    return this.form.get('label') as UntypedFormControl;
  }

  get statusCodeCtrl(): UntypedFormControl {
    return this.form.get('statusCode') as UntypedFormControl;
  }

  get delayCtrl(): UntypedFormControl {
    return this.form.get('delay') as UntypedFormControl;
  }

  get contentTypeCtrl(): UntypedFormControl {
    return this.form.get('contentType') as UntypedFormControl;
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
