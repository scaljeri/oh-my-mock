import { patchAddEventListener, unpatchAddEventListener } from './xhr/add-event-listener';
import { patchSetRequestHeader, unpatchSetRequestHeader } from './xhr/set-request-header';
import { patchOpen, unpatchOpen } from './xhr/open';
import { patchSend, unpatchSend } from './xhr/send';
import { patchStatus, unpatchStatus } from './xhr/status';
import { patchResponseText, unpatchResponseText } from './xhr/response-text';
import { patchResponse, unpatchResponse } from './xhr/response';
import { patchResponseHeaders, unpatchResponseHeaders } from './xhr/response-headers';

export function unpatchXmlHttpRequest() {
  unpatchAddEventListener();
  unpatchSetRequestHeader();
  unpatchResponseHeaders()
  unpatchOpen();
  unpatchSend();
  unpatchStatus();
  unpatchResponseText();
  unpatchResponse();
}

export function patchXmlHttpRequest() {
  patchAddEventListener();
  patchSetRequestHeader();
  patchResponseHeaders();
  patchOpen();
  patchSend();
  patchStatus();
  patchResponseText();
  patchResponse();
}
