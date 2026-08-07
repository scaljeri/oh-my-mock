import { appSources } from "../shared/constants";
import { IPacket, IPacketPayload } from "../shared/packet-type";
import { ownWindowTarget } from "../shared/utils/own-origin";
import { error } from "./utils";

/**
 * Hands a packet to the injected script.
 *
 * The payload used to go through `JSON.parse(JSON.stringify(...))` first, and
 * `postMessage` then structured-clones it anyway — stringify, parse,
 * clone-serialise, clone-deserialise: four full passes over every mocked body,
 * two of them blocking the isolated world and two the page. Measured at 200KB,
 * the redundant JSON round trip alone costs about five times the clone it was
 * standing in front of, and it is worse for base64 image mocks, which carry a
 * third more bytes through all of it.
 *
 * It was presumably there to strip values structured clone cannot carry. It
 * does not need to be: `postMessage` throws `DataCloneError` on one, and that
 * is caught below and reported — which is better than silently turning a
 * function or a `Map` into nothing and letting the page get a body with a hole
 * in it.
 */
export function sendMessageToInjected(payload: IPacketPayload) {
  try {
    window.postMessage(
      { payload, source: appSources.CONTENT } as IPacket,
      // Was `OhMyContentState.href` — the page's full url, of which
      // `postMessage` uses only the origin. That is the *url's* origin, and on
      // a `Content-Security-Policy: sandbox` page the document's is `"null"`
      // instead, so every answer to the page-context bundle was dropped
      // undelivered. See `own-origin.ts`.
      ownWindowTarget()
    );
  } catch (err) {
    // The injected script is waiting on this message, so a failure here is a
    // request that never gets an answer. It used to be swallowed under a bare
    // `// TODO`, which made that look like nothing had happened.
    error(`Could not reach the injected script (${payload.description})`, err);
  }
}
