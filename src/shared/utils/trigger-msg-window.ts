import { IOhMessage, IPacket, ohMessage } from "../packet-type";

/**
 * Receives packets posted on `window` — the channel between the injected script
 * (page context) and the content script (isolated world).
 *
 * `window.postMessage` is a public channel: any script in the page, in an
 * iframe, or in an opener window can post to it. Without a check, any of them
 * could impersonate the injected script and drive the content script — feeding
 * it fabricated API requests, or provoking replies that carry cached responses.
 *
 * Two conditions have to hold:
 *
 *  1. `event.source === window` — the message came from this same window, not
 *     from a frame, a popup or an opener.
 *  2. the origin matches this document's own.
 *
 * The source check is the stronger of the two and is what rules out other
 * frames; the origin check is a second line of defence. Documents with an
 * opaque origin (sandboxed iframes, `file://`) report `"null"`, which is
 * compared as-is rather than turned into an exemption.
 */
export function triggerWindow(cb: ohMessage): () => void {
  const f = (ev: MessageEvent) => {
    if (ev.source !== window || ev.origin !== window.location.origin) {
      return;
    }

    const packet = ev.data as IPacket;

    cb({ packet } as IOhMessage);
  };

  window.addEventListener('message', f);

  return () => window.removeEventListener('message', f);
}
