import { STORAGE_KEY } from '../../shared/constants';
import { IOhMyResponseUpdate } from '../../shared/packet-type';
import { IOhMyAPIRequest } from '../../shared/types';
import { convertToB64 } from '../../shared/utils/binary';
import { extractMimeType, isMimeTypeText } from '../../shared/utils/mime-type';
import { dispatchApiResponse } from '../message/dispatch-api-response';
import { removeDomainFromUrl } from '../utils';

export async function persistResponse(response: Response, request: IOhMyAPIRequest): Promise<IOhMyResponseUpdate | undefined> {
  if (!window[STORAGE_KEY].state?.active) {
    return undefined;
  }

  if (response['ohResult']) {
    return response['ohResult'];
  }

  const clone = await response.clone();
  const headers = Object.fromEntries(clone.headers['entries']());

  const mt = extractMimeType(headers);
  let output: Record<string, string> | string;

  if (mt === 'json') {
    output = await clone.json();

  } else if (isMimeTypeText(mt)) {
    output = await clone.text();

  } else {
    output = await convertToB64(await clone.blob());
  }

  const ohResult = {
    request: { url: removeDomainFromUrl(response['ohUrl'] || response.url), requestMethod: response['ohMethod'] || request?.requestMethod, requestType: 'FETCH' },
    response: { statusCode: clone['__status'], response: output, headers }
  } as IOhMyResponseUpdate;

  dispatchApiResponse(ohResult);
  response['ohResult'] = ohResult;

  return ohResult;
}
