import { contextTypes, DEMO_TEST_DOMAIN, objectTypes, payloadType } from "../../shared/constants";
import { IPacketPayload } from "../../shared/packet-type";
import { IOhMyBackup, IOhMyDomain, IOhMyDomainContext, IOhMyRequest } from "../../shared/types";
import { importJSON } from "../../shared/utils/import-json";
import { OhMyQueue } from "../../shared/utils/queue";
import { StorageUtils } from "../../shared/utils/storage";
import jsonFromFile from '../../shared/dummy-data.json';


// Not for Response/IMock
export class OhMyRemoveHandler {
  static StorageUtils = StorageUtils;
  static queue: OhMyQueue;

  static async update({ data, context }: IPacketPayload<{ type: objectTypes, id: string }, IOhMyDomainContext>): Promise<IOhMyDomain | undefined> {
    const state = await OhMyRemoveHandler.StorageUtils.get<IOhMyDomain>(context?.key);

    if (!data || !state) {
      return;
    }

    try {
      if (data.type === objectTypes.DOMAIN) { // Delete State
        // All requests are need to be able to delete responses
        const deletes = [] as Promise<void>[];
        const promises = Object.values(state.requests).map(requestId => OhMyRemoveHandler.StorageUtils.get<IOhMyRequest>(requestId));
        const responses = (await Promise.all(promises)).flatMap((request: IOhMyRequest) => {
          deletes.push(OhMyRemoveHandler.StorageUtils.remove(request.id) as Promise<void>);
          return Object.values(request.responses);
        });

        // Delete all requests
        await Promise.all(deletes);

        // Delete all responses
        for (const r of responses) {
          await StorageUtils.remove(r.id);
        }

        // Delete domain
        await StorageUtils.remove(state.domain);

        if (state.domain === DEMO_TEST_DOMAIN) {
          await importJSON(jsonFromFile as unknown as IOhMyBackup, { key: DEMO_TEST_DOMAIN, active: true, type: contextTypes.DOMAIN });
        }
      } else if (data.type === objectTypes.REQUEST) { // Delete request
        const request = await OhMyRemoveHandler.StorageUtils.get<IOhMyRequest>(data.id);
        for (const responseId in request.responses) {
          await StorageUtils.remove(responseId);
        }

        delete state.requests[data.id];

        return await new Promise<IOhMyDomain>(r =>
          OhMyRemoveHandler.queue.addPacket(payloadType.DOMAIN,
            { payload: state }, s => r(s as IOhMyDomain)));
      } else {
        // eslint-disable-next-line no-console
        console.log(`Cannot remove type ${data.type} (not implemented)`)
        return;
      }
    } catch (error) {
    }

    return state;
  }
}
