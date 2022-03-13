import { IOhMyResponseUpdate } from '../../shared/packet-type';
import { IOhMyAPIRequest } from '../../shared/type';
import { convertToB64 } from '../../shared/utils/binary';
import { extractMimeType, isMimeTypeText } from '../../shared/utils/mime-type';
import { dispatchApiResponse } from '../message/dispatch-api-response';
import { removeDomainFromUrl } from '../utils';

export async function persistResponse(response: Response, request: IOhMyAPIRequest): Promise<void> {
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

  dispatchApiResponse({
    request: { url: removeDomainFromUrl(response['ohUrl'] || response.url), method: response['ohMethod'] || request?.method, requestType: 'FETCH' },
    response: { statusCode: clone.status, response: output, headers },
  } as IOhMyResponseUpdate);
}
