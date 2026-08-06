import { patchSend } from './xhr/send';
import { patchStatus, unpatchStatus } from './xhr/status';
import { patchResponseText, unpatchResponseText } from './xhr/response-text';
import { patchResponse, unpatchResponse } from './xhr/response';
import { patchResponseHeaders, unpatchResponseHeaders } from './xhr/response-headers';

/**
 * Patches the members of `XMLHttpRequest.prototype` that carry the *response*.
 *
 * `open`, `send` and `setRequestHeader` are deliberately absent: they are
 * patched by `installEntryPoints` (`./entry-points.ts`), the first thing this
 * bundle runs, before any page code can take a reference to the originals.
 * `addEventListener` is patched by nobody — a mocked
 * request completes through `dispatchEvent`, so the listeners never need to be
 * collected. There used to be a second, unused copy of each of those patches
 * under `./xhr/`; they have been deleted rather than left to look like they
 * might still run.
 */
export function unpatchXmlHttpRequest() {
  unpatchResponseHeaders()
  unpatchStatus();
  unpatchResponseText();
  unpatchResponse();
}

export function patchXmlHttpRequest() {
  patchResponseHeaders();
  // Publishes `xhr.send`, which the entry-point patch forwards to.
  patchSend();
  patchStatus();
  patchResponseText();
  patchResponse();
}
