import { payloadType } from '../../shared/constants';
import { IOhMyResponseUpdate } from '../../shared/packet-type';
import { send } from './send';

/**
 * Reports a real (unmocked) response back to the extension, so it can be
 * offered as a new mock.
 *
 * This is outbound only. It deliberately does not touch
 * `ohMyWindow().cache`, which holds the mock decisions still waiting to be
 * matched to a request: a recorded response is never matched to anything (the
 * patches keep it on the request object itself), so parking it there only left
 * entries behind that no one ever consumed.
 */
export function dispatchApiResponse(payload: IOhMyResponseUpdate) {
  send({
    context: { domain: window.location.host },
    type: payloadType.RESPONSE,
    data: { ...payload },
    description: 'injected; dispatchApiResponse'
  });
}
