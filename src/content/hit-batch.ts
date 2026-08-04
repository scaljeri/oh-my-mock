import { appSources, payloadType } from '../shared/constants';
import { IOhMyHit } from '../shared/types/request';
import { ohMyDataId } from '../shared/type';
import { OhMySendToBg } from '../shared/utils/send-to-background';
import { sendMsgToPopup } from '../shared/utils/send-to-popup';
import { OhMyContentState } from './content-state';

/**
 * How long hits are collected before being written.
 *
 * Nothing reads `lastHit` or `calledAt` synchronously — they order the list and
 * say when a request was last called. A quarter of a second of imprecision on
 * that is not observable; a storage write per intercepted request is.
 */
const FLUSH_INTERVAL = 250;

/**
 * The most recent hit per request, waiting to be written.
 *
 * A map, not a list: fifty calls to the same endpoint inside one interval are
 * one write, because only the last timestamp survives anyway.
 */
const pending = new Map<ohMyDataId, number>();
let timer: ReturnType<typeof setTimeout> | undefined;

/**
 * Records that a request was just served, and tells the popup at once.
 *
 * These used to be the same act: every intercepted request sent its whole
 * `IData` record to the background, which wrote it to `chrome.storage`. That is
 * a service-worker wake, a disk write, and — because `chrome.storage.onChanged`
 * is browser-wide and the content script matches `<all_urls>` — a fan-out to
 * every open tab in the browser. Per call. For a timestamp.
 *
 * They are two different things and are treated as two:
 *
 * - **Writing** is persistence, and is batched. Only the *timestamp* is
 *   delayed; a request that is not yet known does not come through here at all
 *   (this runs only for a request the extension already found), so nothing is
 *   kept out of the list by the wait.
 * - **The hit** is a notification, and goes out immediately, carrying two
 *   fields rather than a whole record. The popup's request list moves the
 *   moment the call happens instead of when the disk catches up.
 */
export function recordHit(id: ohMyDataId, at: number): void {
  pending.set(id, at);

  sendMsgToPopup(null, OhMyContentState.host, appSources.CONTENT, {
    type: payloadType.HIT,
    data: { id, at } as IOhMyHit,
    description: 'content;hit'
  });

  if (timer === undefined) {
    timer = setTimeout(flushHits, FLUSH_INTERVAL);
  }
}

/** Writes whatever has been collected. Safe to call with nothing pending. */
export function flushHits(): void {
  clearTimeout(timer);
  timer = undefined;

  if (!pending.size) {
    return;
  }

  const hits: IOhMyHit[] = [...pending].map(([id, at]) => ({ id, at }));
  pending.clear();

  OhMySendToBg.full(
    hits,
    payloadType.HITS,
    { domain: OhMyContentState.host },
    'content;hits'
  );
}

/**
 * Flushes on the way out.
 *
 * `pagehide` rather than `unload`: `unload` is not fired on a page restored
 * from the back/forward cache and is deprecated for it. Without this, up to a
 * quarter of a second of hits are lost when a page is closed — which is exactly
 * when someone alt-tabs to the popup to look at them.
 */
export function flushHitsOnLeave(): void {
  window.addEventListener('pagehide', flushHits);
}
