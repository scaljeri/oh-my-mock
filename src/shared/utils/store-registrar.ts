import { payloadType } from '../constants';
import { ohMyDomain } from '../type';
import { OhMySendToBg } from './send-to-background';

/**
 * "Put this domain in the store's list of domains."
 *
 * A seam, because the one caller — `importJSON` — runs in two places. In the
 * popup the store record is not ours to touch: it belongs to the background,
 * which is the only context that can serialise a change to it against every
 * other change (`src/background/store-writer.ts`). Reading it here, adding a
 * domain and writing it back is exactly the read-modify-write that used to drop
 * whichever domain, group or flag the background had written in between.
 *
 * So from anywhere else this *asks*. The background replaces the implementation
 * with its own, since a service worker's `chrome.runtime.sendMessage` reaches
 * every other extension context but not itself — an import running there would
 * ask a question nobody answers.
 *
 * A field rather than a parameter of `importJSON` so that no call site can
 * forget it: registering the imported domain is part of importing, and the two
 * places it may run are a property of the bundle, not of the caller.
 */
export class StoreRegistrar {
  static addDomain: (domain: ohMyDomain) => Promise<unknown> = (domain) =>
    OhMySendToBg.full(
      undefined,
      payloadType.ADD_DOMAIN,
      { domain },
      'import;add-domain'
    );
}
