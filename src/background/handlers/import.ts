import { OhMyAPIUpsert } from "../../shared/api-types";
import { IOhMyImportStatus, IOhMyPacketContext, IPacketPayload } from "../../shared/packet-type";
import { importJSON, ImportResultEnum } from "../../shared/utils/import-json";
import { StorageUtils } from "../../shared/utils/storage";

export class OhMyImportHandler {
  static StorageUtils = StorageUtils;

  // The UPSERT packet comes from the public API (`src/injected/api.ts`), which
  // only sends a domain — there is no preset in an API call.
  static async upsert(payload: IPacketPayload<OhMyAPIUpsert, IOhMyPacketContext>): Promise<IOhMyImportStatus> {
    let result = { status: ImportResultEnum.ERROR };

    try {
      const { data, context } = payload;

      if (!data || !context) { // Nothing to import, or nowhere to import it to
        return result;
      }

      result = await importJSON(
        data,
        // `importJSON` only reads `domain` and `active`; the preset it imports
        // into is the one on the state, which is 'default' for a new domain.
        { active: true, ...context, preset: context.preset ?? 'default' },
        OhMyImportHandler.StorageUtils);

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
