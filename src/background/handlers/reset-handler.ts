import { DEMO_TEST_DOMAIN, objectTypes } from "../../shared/constants";
import { IPacketPayload } from "../../shared/packet-type";
import { IOhMyBackup, IOhMyDomain } from "../../shared/type";
import { importJSON } from "../../shared/utils/import-json";
import { StorageUtils } from "../../shared/utils/storage";
import { initStorage } from "../init";
import jsonFromFile from '../../shared/dummy-data.json';
import { error } from "../utils";

export class OhMyResetHandler {
  static StorageUtils = StorageUtils;
  static importJSON = importJSON;
  static initStorage = initStorage;
  static jsonFromFile = jsonFromFile;

  static async update(payload: IPacketPayload<{ type: objectTypes, id: string }>): Promise<IOhMyDomain | undefined> {
    try {
      await OhMyResetHandler.StorageUtils.reset();
      await OhMyResetHandler.initStorage(payload.context?.domain);
      await OhMyResetHandler.importJSON(jsonFromFile as any as IOhMyBackup, { domain: DEMO_TEST_DOMAIN, active: true });

      return OhMyResetHandler.StorageUtils.get<IOhMyDomain>(DEMO_TEST_DOMAIN);
    } catch (err) {
      error('Could not initialize the store', err);
    }
  }
}
