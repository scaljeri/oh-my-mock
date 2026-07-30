import { appSources, ohMyMockStatus, payloadType } from '../shared/constants';
import { IOhMessage, IOhMyPacketContext } from '../shared/packet-type';
import { IData, IMock, IOhMyEvalRequest, IState } from '../shared/type';
import { DataUtils } from '../shared/utils/data';
import { OhMyMessageBus } from '../shared/utils/message-bus';
import { StateUtils } from '../shared/utils/state';
import { StorageUtils } from '../shared/utils/storage';
import { triggerRuntime } from '../shared/utils/trigger-msg-runtime';
import { evalInSandbox } from './sandbox-host';

/**
 * Answers "run this request's custom code" for the content script.
 *
 * The lookup happens here rather than in whatever hosts the sandbox. It used to
 * live in the popup's `SandboxService`, which meant the thing that owned the
 * iframe also had to own a copy of the state; the offscreen document that owns
 * it now holds nothing at all, and is the better for it.
 *
 * Mirrors `server-dispatcher.ts`, which answers `DISPATCH_TO_SERVER` the same
 * way — one subscriber, one `callback`.
 */
const mb = new OhMyMessageBus().setTrigger(triggerRuntime);

mb.streamByType$<IOhMyEvalRequest>(payloadType.EVAL, appSources.CONTENT).subscribe(
  async ({
    packet,
    callback
  }: IOhMessage<IOhMyEvalRequest, IOhMyPacketContext>) => {
    const context = packet.payload.context;
    const input = packet.payload.data;

    if (!context?.domain || !input?.request) {
      callback({ status: ohMyMockStatus.NO_CONTENT });

      return;
    }

    const mock = await findMock(context.domain, input);

    if (!mock) {
      // Nothing to run. The content script reads a non-OK status as "no mock
      // came back" and falls through to the real response.
      callback({ status: ohMyMockStatus.NO_CONTENT });

      return;
    }

    callback(await evalInSandbox(mock, input.request, input.response));
  }
);

/** The mock the active preset serves for this request, if there is one. */
async function findMock(
  domain: string,
  input: IOhMyEvalRequest
): Promise<IMock | undefined> {
  const state = await StorageUtils.get<IState>(domain);

  if (!state) {
    return undefined;
  }

  // The background keeps no cache, so the domain's requests are read here — one
  // batch call — and handed to the lookup.
  const requests = await StorageUtils.getMany<IData>(state.requests);
  const data = StateUtils.findRequest(state, requests, input.request);

  if (!data) {
    return undefined;
  }

  const mockId = DataUtils.activeMock(data, state.context);

  return mockId ? await StorageUtils.get<IMock>(mockId) : undefined;
}
