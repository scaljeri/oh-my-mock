import { appSources, payloadType } from '../../shared/constants';
import { IOhMyPacketContext, IPacketPayload } from '../../shared/packet-type';
import { IOhMyCookie, IState, ohMyCookieId, ohMyDomain } from '../../shared/type';
import { CookieUtils, IOhMyCookieUpdate } from '../../shared/utils/cookie';
import { OhMyQueue } from '../../shared/utils/queue';
import { StorageUtils } from '../../shared/utils/storage';
import { timestamp } from '../../shared/utils/timestamp';
import { isApplied, unapplyCookie } from '../cookie-jar';
import { error } from '../utils';

/**
 * Adds, changes and removes cookie mocks.
 *
 * Each mock is its own record, like a response; the state only holds the ids.
 * Applying them is not done here — `cookie-sync` picks the write up from
 * storage. The one exception is deleting, which has to unapply *before* the
 * record is gone, or the jar no longer knows what to put back.
 */
export class OhMyCookieHandler {
  static StorageUtils = StorageUtils;
  static queue: OhMyQueue;

  static async update(
    { data, context }: IPacketPayload<IOhMyCookieUpdate, IOhMyPacketContext>
  ): Promise<IOhMyCookie | undefined> {
    if (!data?.cookie || !context?.domain) {
      error('Cannot update a cookie without a cookie and a domain', data);

      return undefined;
    }

    const state = await OhMyCookieHandler.StorageUtils.get<IState>(context.domain);

    if (!state) {
      error(`Cannot update a cookie for unknown domain ${context.domain}`);

      return undefined;
    }

    try {
      return data.remove
        ? await OhMyCookieHandler.remove(state, data.cookie.id)
        : await OhMyCookieHandler.upsert(state, data.cookie);
    } catch (err) {
      error(`Could not update cookie ${data.cookie.id}`, err);

      return undefined;
    }
  }

  static async upsert(state: IState, update: Partial<IOhMyCookie>): Promise<IOhMyCookie> {
    const stored = update.id
      ? await OhMyCookieHandler.StorageUtils.get<IOhMyCookie>(update.id)
      : undefined;

    const cookie = CookieUtils.init(stored, {
      ...update,
      ...(stored && { modifiedOn: timestamp() })
    });

    await OhMyCookieHandler.StorageUtils.set(cookie.id, cookie);

    const ids = state.cookies ?? [];

    if (!ids.includes(cookie.id)) {
      OhMyCookieHandler.queueStateUpdate(state.domain, [...ids, cookie.id]);
    }

    return cookie;
  }

  static async remove(state: IState, id?: ohMyCookieId): Promise<undefined> {
    if (!id) {
      error('Cannot remove a cookie without an id');

      return undefined;
    }

    const stored = await OhMyCookieHandler.StorageUtils.get<IOhMyCookie>(id);

    // Before the record disappears: the jar identifies what it displaced by the
    // mock, so afterwards there would be nothing left to restore from. Only
    // what was actually applied, though — deleting a mock that was never on
    // must not take the site's real cookie of the same name with it.
    if (stored && isApplied(state.domain, id)) {
      await unapplyCookie(state.domain, stored);
    }

    await OhMyCookieHandler.StorageUtils.remove(id);
    OhMyCookieHandler.queueStateUpdate(state.domain, (state.cookies ?? []).filter(c => c !== id));

    return undefined;
  }

  /**
   * The state is written through the state handler's queue rather than
   * directly, so a cookie change cannot overwrite a request change that is
   * being processed at the same moment.
   */
  static queueStateUpdate(domain: ohMyDomain, cookies: ohMyCookieId[]): void {
    const payload: IPacketPayload<ohMyCookieId[], IOhMyPacketContext> = {
      type: payloadType.STATE,
      data: cookies,
      context: { kind: 'patch', path: '$', propertyName: 'cookies', domain },
      description: 'background;cookie-handler;cookies'
    };

    OhMyCookieHandler.queue.addPacket(payloadType.STATE, { source: appSources.BACKGROUND, payload });
  }
}
