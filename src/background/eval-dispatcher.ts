import { appSources, ohMyMockStatus, payloadType, STORAGE_KEY } from '../shared/constants';
import { IOhMessage, IOhMyPacketContext } from '../shared/packet-type';
import { IData, IMock, IOhMyEvalRequest, IOhMyGroup, IOhMyMock, IState } from '../shared/type';
import { DataUtils } from '../shared/utils/data';
import { GroupUtils } from '../shared/utils/group';
import { OhMyMessageBus } from '../shared/utils/message-bus';
import { OhMyRequestIndex } from '../shared/utils/request-index';
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

/**
 * The mock the active preset serves for this request, if there is one.
 *
 * The same group-aware lookup the content script just served the request with,
 * because the two answer the *same question* a moment apart. This used to be
 * the plain `findRequest` scan, which knows nothing of groups — so for a mock
 * with edited code, the code that ran could come from a group a higher group
 * shadows, or from one this domain has switched off, while the content
 * script's own lookup had resolved the very same call to a different mock.
 * (`response-handler.ts` staying group-blind is deliberate — it asks what
 * exists; this asks what answers.)
 *
 * Exported for its tests; the subscription above is the only production
 * caller.
 */
export async function findMock(
  domain: string,
  input: IOhMyEvalRequest
): Promise<IMock | undefined> {
  const state = await StorageUtils.get<IState>(domain);

  if (!state) {
    return undefined;
  }

  // The background keeps no cache, so the domain's requests and groups are
  // read here — batch calls — and handed to the lookup.
  const store = await StorageUtils.get<IOhMyMock>(STORAGE_KEY);
  const order = [...(store?.groups ?? [])];
  const groups = Object.values(await StorageUtils.getMany<IOhMyGroup>(order))
    .filter((v): v is IOhMyGroup => GroupUtils.isGroup(v));
  const requests = await StorageUtils.getMany<IData>(state.requests);

  const index = new OhMyRequestIndex();
  index.build(state, requests, GroupUtils.localOrDefault(groups, domain));

  const data = index.find(input.request, GroupUtils.activeFor(groups, state, order));

  if (!data) {
    return undefined;
  }

  const mockId = DataUtils.activeMock(data, state.context);

  return mockId ? await StorageUtils.get<IMock>(mockId) : undefined;
}
