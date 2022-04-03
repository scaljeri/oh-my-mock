import { patchAddEventListener, unpatchAddEventListener } from './xhr/add-event-listener';
import { patchSetRequestHeader, unpatchSetRequestHeader } from './xhr/set-request-header';
import { patchOpen, unpatchOpen } from './xhr/open';
import { patchSend, unpatchSend } from './xhr/send';
import { patchStatus, unpatchStatus } from './xhr/status';
import { patchResponseText, unpatchResponseText } from './xhr/response-text';
import { patchResponse, unpatchResponse } from './xhr/response';
import { patchResponseHeaders, unpatchResponseHeaders } from './xhr/response-headers';
import { STORAGE_KEY } from '../shared/constants';

declare let window: any;

export function unpatchXmlHttpRequest() {
  // delete window[STORAGE_KEY].xhr;

  // unpatchAddEventListener();
  // unpatchSetRequestHeader();
  // unpatchOpen();
  // unpatchSend();
  unpatchResponseHeaders()
  unpatchStatus();
  unpatchResponseText();
  unpatchResponse();
}

export function patchXmlHttpRequest() {
  window[STORAGE_KEY].xhr = {};
  // patchAddEventListener();
  // patchSetRequestHeader();
  // patchOpen();
  patchResponseHeaders();
  patchSend();
  patchStatus();
  patchResponseText();
  patchResponse();
}
