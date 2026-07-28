import { OhMyAPIUpsert } from "../../shared/api-types";
import { IOhMyImportStatus, IOhMyPacketContext, IPacketPayload } from "../../shared/packet-type";
import { importJSON, ImportResultEnum } from "../../shared/utils/import-json";
import { StorageUtils } from "../../shared/utils/storage";
import { error } from "../utils";

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
    } catch (err) {
      // The queue answers the caller with whatever comes back, so a failed
      // import has to resolve as an ERROR rather than reject — but it must not
      // do so silently, which is what the empty `catch` (and the empty
      // `finally` behind it) amounted to.
      // `result` still holds the ERROR it was initialised with: the only
      // assignment to it is the `await` that just threw.
      error('Could not import the backup', err);
    }

    return result;
  }
}
