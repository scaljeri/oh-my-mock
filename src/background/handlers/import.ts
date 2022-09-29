import { OhMyAPIUpsert } from "../../shared/api-types";
import { contextTypes } from "../../shared/constants";
import { IOhMyImportStatus, IPacketPayload } from "../../shared/packet-type";
import { IOhMyContext, IOhMyDomainContext } from "../../shared/types";
import { importJSON, ImportResultEnum } from "../../shared/utils/import-json";
import { StorageUtils } from "../../shared/utils/storage";

export class OhMyImportHandler {
  static StorageUtils = StorageUtils;

  static async update(payload: IPacketPayload<OhMyAPIUpsert, IOhMyContext>): Promise<IOhMyImportStatus> {
    let result = { status: ImportResultEnum.ERROR };

    try {
      const { data, context } = payload;

      result = await importJSON(data, { active: true, ...context, type: contextTypes.DOMAIN } as IOhMyDomainContext, OhMyImportHandler.StorageUtils);

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
