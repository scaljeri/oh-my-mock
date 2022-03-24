import { IOhMessage } from "../../shared/packet-type";
import { OhMyContentState } from "../content-state";

export function handleExternalInsert(contentState: OhMyContentState) {
  return ({ packet }: IOhMessage<{ active: boolean }>) => {
  }
}
