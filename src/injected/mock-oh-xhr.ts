import { patchSend } from './xhr/send';
import { patchStatus, unpatchStatus } from './xhr/status';
import { patchResponseText, unpatchResponseText } from './xhr/response-text';
import { patchResponse, unpatchResponse } from './xhr/response';
import { patchResponseHeaders, unpatchResponseHeaders } from './xhr/response-headers';

/**
 * Patches the members of `XMLHttpRequest.prototype` that carry the *response*.
 *
 * `open`, `send`, `setRequestHeader` and `addEventListener` are deliberately
 * absent: they are patched by `src/early-inject/index.ts`, which runs at
 * `document_start`, before any page code can take a reference to the originals.
 * This bundle loads too late for that. There used to be a second, unused copy
 * of each of those patches under `./xhr/`; they have been deleted rather than
 * left to look like they might still run.
 */
export function unpatchXmlHttpRequest() {
  unpatchResponseHeaders()
  unpatchStatus();
  unpatchResponseText();
  unpatchResponse();
}

export function patchXmlHttpRequest() {
  patchResponseHeaders();
  // Publishes `xhr.send`, which `src/early-inject` is waiting for.
  patchSend();
  patchStatus();
  patchResponseText();
  patchResponse();
}
