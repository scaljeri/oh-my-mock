import { IOhMessage, IPacket, ohMessage } from "../packet-type";

export function triggerWindow(cb: ohMessage): () => void {
  const f = (ev) => {
    const packet = ev.data as IPacket;

    cb({ packet } as IOhMessage);
  };

  window.addEventListener('message', f);

  return () => window.removeEventListener('message', f);
}
