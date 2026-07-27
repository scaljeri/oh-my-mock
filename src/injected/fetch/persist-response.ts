import { IOhMyResponseUpdate } from '../../shared/packet-type';
import { ohMyWindow } from '../../shared/oh-my-window';
import { IOhMyAPIRequest } from '../../shared/type';
import { convertToB64 } from '../../shared/utils/binary';
import { extractMimeType, isMimeTypeText } from '../../shared/utils/mime-type';
import { dispatchApiResponse } from '../message/dispatch-api-response';
import { removeDomainFromUrl } from '../utils';
import { asOhMyResponse, IOhMyResult, IOhMyResponse } from './oh-my-response';

/**
 * Sends a real (unmocked) response to the background script so it shows up in
 * the popup as a request that can be mocked.
 *
 * `request` is optional: `status.ts` calls in for a response the extension has
 * no cache entry for at all, and then the url and method come off the response.
 */
export async function persistResponse(response: IOhMyResponse, request?: IOhMyAPIRequest): Promise<IOhMyResult | undefined> {
  if (!ohMyWindow().state?.active) {
    return;
  }

  // Guards against persisting the same body twice. Note that this also fires
  // when `ohResult` holds a *mock lookup* rather than a persisted record, which
  // is what stops the clone below from being persisted a second time in its own
  // right: reading `clone.headers`/`clone.json()` goes through the patched
  // accessors, which park a lookup on the clone and call back in here.
  if (response.ohResult) {
    return response.ohResult;
  }

  // `clone()` is not async — the `await` it used to have only cost a tick.
  const clone = asOhMyResponse(response.clone());
  const headers = Object.fromEntries(clone.headers.entries());

  const mt = extractMimeType(headers);
  let output: Record<string, string> | string;

  if (mt === 'json') {
    output = await clone.json();

  } else if (isMimeTypeText(mt)) {
    output = await clone.text();

  } else {
    output = await convertToB64(await clone.blob());
  }

  const ohResult: IOhMyResponseUpdate = {
    request: {
      url: removeDomainFromUrl(response.ohUrl || response.url),
      method: response.ohMethod || request?.method,
      requestType: 'FETCH'
    },
    response: {
      // `__status` is the untouched native getter, so this is the real status
      // even while the `status` patch is installed.
      statusCode: clone.__status,
      // `IMock.response` is declared `string`, but a JSON body is stored parsed
      // and every reader branches on `typeof response === 'string'` — see the
      // note in the report about widening that field.
      response: output as string,
      headers
    }
  };

  dispatchApiResponse(ohResult);
  response.ohResult = ohResult;

  return ohResult;
}
