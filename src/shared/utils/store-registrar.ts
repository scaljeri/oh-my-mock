import { payloadType } from '../constants';
import { ohMyDomain } from '../type';
import { OhMySendToBg } from './send-to-background';

/**
 * "Put this domain in the store's list of domains."
 *
 * A seam, because the one caller — `importJSON` — used to run in two places.
 * Outside the background the store record is not ours to touch: it belongs to
 * the background, which is the only context that can serialise a change to it
 * against every other change (`src/background/store-writer.ts`). Reading it
 * elsewhere, adding a domain and writing it back is exactly the read-modify-
 * write that used to drop whichever domain, group or flag the background had
 * written in between.
 *
 * So from anywhere else this *asks*, and the background replaces the
 * implementation with its own — a service worker's `chrome.runtime.sendMessage`
 * reaches every other extension context but not itself, so an import running
 * there would ask a question nobody answers.
 *
 * Every import goes through the background now: the popup's `.json` and HAR
 * dialogs send the backup to `OhMyImportHandler` rather than writing records of
 * their own, because a write from the popup's process is invisible to the wipe
 * barrier and one racing a full reset left records nothing lists. The asking
 * branch is therefore unreached in the shipped extension, and it stays: it is
 * what makes calling `importJSON` from another context safe instead of quietly
 * wrong, which is a poor thing to discover by losing a domain list.
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
