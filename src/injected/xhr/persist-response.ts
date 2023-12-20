import { STORAGE_KEY } from '../../shared/constants';
import { IOhMyAPIRequest, IOhMyResponseUpdate, IOhMyResponseUpsert } from '../../shared/types';
import { convertToB64 } from '../../shared/utils/binary';
import { parse } from '../../shared/utils/xhr-headers';
import { dispatchApiResponse } from '../message/dispatch-api-response';
import { removeDomainFromUrl } from '../utils';

export async function persistResponse(xhr: XMLHttpRequest, request: IOhMyAPIRequest): Promise<void> {
  if (xhr['__ohIsPerisisted'] || !window[STORAGE_KEY].state?.active || xhr['__ohMyHasError']) {
    return;
  }

  xhr['__ohIsPerisisted'] = true;

  const headers = parse(xhr['__getAllResponseHeaders']());
  const rt = xhr.responseType;

  let output: Record<string, string> | string;

  if (rt === 'json') {
    output = xhr['__response'];
  } else if (rt === 'blob' || rt === 'arraybuffer') {
    output = await convertToB64(xhr['__response']);
  } else if (rt === '' || rt === 'text') {
    output = xhr['__responseText'];
  } else {
    // eslint-disable-next-line no-console
    return console.error(`XHR Error: OhMyMock does not support response type ${rt}.\nPlease file a feature request if you need this to be fixed!`);
  }

  dispatchApiResponse({
    request: {
      url: removeDomainFromUrl(xhr['ohUrl'] || request.url),
      method: xhr['ohMethod'] || request?.requestMethod,
      requestType: 'XHR'
    },
    update: { statusCode: xhr['__status'], response: output, headers },
  } as IOhMyResponseUpsert);
}
