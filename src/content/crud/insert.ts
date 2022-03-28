import { IOhMessage } from "../../shared/packet-type";
import { IOhMyCrud, IOhMyStateUpdateResult } from "../../shared/type";
import { ImportResultEnum } from "../../shared/utils/import-json";
import { OhMySendToBg } from "../../shared/utils/send-to-background";
import { OhMyContentState } from "../content-state";

export function handleExternalInsert(contentState: OhMyContentState) {
  return async ({ packet }: IOhMessage<IOhMyCrud>) => {
    const payloadType = packet.payload.type;
    const data = { activate: true, ...packet.payload.data } as IOhMyCrud;

    const result = await OhMySendToBg.full<IOhMyCrud, IOhMyStateUpdateResult>(
      data, payloadType, { domain: OhMyContentState.host });


    console.log('External extion was ', result.status === ImportResultEnum.SUCCESS ? 'Successful' : 'Unsuccessful');
  }
}
