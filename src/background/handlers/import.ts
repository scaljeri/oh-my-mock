import { OhMyAPIUpsert } from "../../shared/api-types";
import { IOhMyImportStatus, IPacketPayload } from "../../shared/packet-type";
import { importJSON, ImportResultEnum } from "../../shared/utils/import-json";
import { StorageUtils } from "../../shared/utils/storage";

export class OhMyImportHandler {
  static StorageUtils = StorageUtils;
  // data: IOhMyBackup, context: IOhMyContext, { activate = false } = {}
  static async upsert(payload: IPacketPayload<OhMyAPIUpsert>): Promise<IOhMyImportStatus> {
    const { data, context } = payload;

    let result = { status: ImportResultEnum.ERROR };
    try {
      const { requests, responses } = data;

      result = await importJSON(data, context, { activate: true }, OhMyImportHandler.StorageUtils);

      if (result.status === ImportResultEnum.SUCCESS) {
        // this.toast.success(`Imported ${requests.length} requests and  ${responses.length} responses from ${file.name} into ${this.appState.domain}`);
      } else if (result.status === ImportResultEnum.TOO_OLD) {
        // this.toast.error(`Import failed, your version of OhMyMock is too old`)
      }
    } catch {
      // this.toast.error(`File ${file} does not contain (valid) JSON`);
    } finally {
      // this.isUploading = false;
    }

    return result;
  }
}
