import { Pipe, PipeTransform } from '@angular/core';

/** How a status code should read: success, a redirect, or a failure. */
export type OhMyTone = 'success' | 'warning' | 'danger' | 'muted';

/**
 * Maps an HTTP status code to a tone, matching `codeFg()` in
 * `design/Mock Manager v2.dc.html`.
 *
 * A pipe rather than a class binding in the template, because the same mapping
 * is needed for the code itself, for the row it sits in, and for the detail
 * pane — and because it is the kind of boundary logic that is worth a test.
 */
@Pipe({ name: 'ohStatusCodeTone' })
export class StatusCodeTonePipe implements PipeTransform {
  transform(code: number | null | undefined): OhMyTone {
    if (code === null || code === undefined || !Number.isFinite(code)) {
      return 'muted';
    }

    if (code >= 400) {
      return 'danger';
    }

    if (code >= 300) {
      return 'warning';
    }

    return 'success';
  }
}
