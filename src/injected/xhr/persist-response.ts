import { IOhMyResponseUpdate } from '../../shared/packet-type';
import { ohMyWindow } from '../../shared/oh-my-window';
import { IOhMyAPIRequest } from '../../shared/type';
import { convertToB64 } from '../../shared/utils/binary';
import { parse } from '../../shared/utils/xhr-headers';
import { dispatchApiResponse } from '../message/dispatch-api-response';
import { IOhMyXhr } from '../oh-my-xhr';
import { error, removeDomainFromUrl } from '../utils';

export async function persistResponse(xhr: IOhMyXhr, request: IOhMyAPIRequest): Promise<void> {
  if (xhr.__ohIsPerisisted || !ohMyWindow().state?.active || xhr.__ohMyHasError) {
    return;
  }

  xhr.__ohIsPerisisted = true;

  const headers = parse(xhr.__getAllResponseHeaders());
  const rt = xhr.responseType;
  const raw = xhr.__response;

  // A mock is stored as text (`IMock.response` is a string), so whatever the
  // page asked for has to be turned back into one here.
  let output: string;

  if (rt === 'json') {
    output = JSON.stringify(raw);
  } else if (rt === 'blob' || rt === 'arraybuffer') {
    if (typeof raw !== 'string' && !(raw instanceof Blob) && !(raw instanceof ArrayBuffer)) {
      return error(`XHR Error: OhMyMock expected a ${rt} response, but got`, raw);
    }

    output = await convertToB64(raw);
  } else if (rt === '' || rt === 'text') {
    output = xhr.__responseText;
  } else {
    return error(`XHR Error: OhMyMock does not support response type ${rt}.\nPlease file a feature request if you need this to be fixed!`);
  }

  const update: IOhMyResponseUpdate = {
    request: {
      url: removeDomainFromUrl(xhr.ohUrl || request.url),
      method: xhr.ohMethod || request?.method,
      requestType: 'XHR'
    },
    response: { statusCode: xhr.__status, response: output, headers }
  };

  dispatchApiResponse(update);
}
