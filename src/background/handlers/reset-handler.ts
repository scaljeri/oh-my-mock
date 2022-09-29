import { contextTypes, DEMO_TEST_DOMAIN, objectTypes } from "../../shared/constants";
import { IPacketPayload } from "../../shared/packet-type";
import { IOhMyBackup, IOhMyDomain } from "../../shared/types";
import { importJSON } from "../../shared/utils/import-json";
import { StorageUtils } from "../../shared/utils/storage";
import { initStorage } from "../init";
import jsonFromFile from '../../shared/dummy-data.json';
import { error } from "../utils";
import { IOhMyDomainContext } from "../../shared/types";

export class OhMyResetHandler {
  static StorageUtils = StorageUtils;
  static importJSON = importJSON;
  static initStorage = initStorage;
  static jsonFromFile = jsonFromFile;

  static async update(payload: IPacketPayload<{ type: objectTypes, id: string }, IOhMyDomainContext>): Promise<IOhMyDomain | undefined> {
    try {
      await OhMyResetHandler.StorageUtils.reset();
      await OhMyResetHandler.initStorage(payload.context?.key);
      await OhMyResetHandler.importJSON(jsonFromFile as unknown as IOhMyBackup, { key: DEMO_TEST_DOMAIN, active: true, type: contextTypes.DOMAIN });

      return OhMyResetHandler.StorageUtils.get<IOhMyDomain>(DEMO_TEST_DOMAIN);
    } catch (err) {
      error('Could not initialize the store', err);
    }
  }
}
