import { IOhMyPacketContext, IPacketPayload } from '../../shared/packet-type';
import { IData, IOhMyHit } from '../../shared/type';
import { StorageUtils } from '../../shared/utils/storage';
import { error } from '../utils';

/**
 * Records that requests were served, from a batch.
 *
 * Every intercepted call used to send its whole `IData` record here to have two
 * numbers updated. That is a service-worker wake, a `chrome.storage` write, and
 * — because `onChanged` is browser-wide and the content script matches
 * `<all_urls>` — a fan-out to every open tab. Per call.
 *
 * The content script collects them instead (`content/hit-batch.ts`), keeping
 * only the latest timestamp per request, so a page hammering one endpoint fifty
 * times in a quarter of a second costs one write rather than fifty.
 *
 * Only the two fields are touched. The record is re-read here rather than taken
 * from the message, so a hit cannot overwrite an edit the popup made while the
 * batch was waiting — which the old "send the whole record" version could, and
 * did, whenever someone changed a mock during a burst of traffic.
 */
export class OhMyHitsHandler {
  static StorageUtils = StorageUtils;

  static async update(
    payload: IPacketPayload<IOhMyHit[], IOhMyPacketContext>
  ): Promise<number | undefined> {
    const hits = payload?.data;

    if (!Array.isArray(hits) || !hits.length) {
      return 0;
    }

    let written = 0;

    for (const hit of hits) {
      if (!hit?.id || typeof hit.at !== 'number') {
        continue;
      }

      try {
        const request = await OhMyHitsHandler.StorageUtils.get<IData>(hit.id);

        // The request was deleted while its hit was waiting. Storing it would
        // resurrect a record with nothing in it but two timestamps.
        if (!request) {
          continue;
        }

        await OhMyHitsHandler.StorageUtils.set(hit.id, {
          ...request,
          lastHit: hit.at,
          calledAt: hit.at
        });
        written++;
      } catch (err) {
        error(`Could not record that ${hit.id} was served`, err);
      }
    }

    return written;
  }
}
