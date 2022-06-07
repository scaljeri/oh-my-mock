import { OhMyAPIUpsert } from "../../shared/api-types";
import { IOhMyImportStatus, IPacketPayload } from "../../shared/packet-type";
import { IOhMyContext } from "../../shared/type";
import { importJSON, ImportResultEnum } from "../../shared/utils/import-json";
import { StorageUtils } from "../../shared/utils/storage";

export class OhMyImportHandler {
  static StorageUtils = StorageUtils;

  static async upsert(payload: IPacketPayload<OhMyAPIUpsert, IOhMyContext>): Promise<IOhMyImportStatus> {
    let result = { status: ImportResultEnum.ERROR };

    try {
      const { data, context } = payload;

      result = await importJSON(data, { active: true, ...context }, OhMyImportHandler.StorageUtils);

      if (result.status === ImportResultEnum.SUCCESS) {
        result.status = ImportResultEnum.SUCCESS;

      } else if (result.status === ImportResultEnum.TOO_OLD) {
        result.status = ImportResultEnum.TOO_OLD;
      }
    } catch {
    } finally {
    }

    return result;
  }
}
