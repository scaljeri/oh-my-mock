import { filter, first, map, Observable } from "rxjs"
import { IOhMyStatus, OhMyAPIUpsert } from "../shared/api-types"
import { payloadType, STORAGE_KEY } from "../shared/constants"
import { IOhMyImportStatus } from "../shared/packet-type"
import { IOhMyContext, IOhMyDomainContext } from "../shared/types"
import { uniqueId } from "../shared/utils/unique-id"
import { send } from "./message/send"

// Listen for responses
export function initApi(updates$: Observable<IOhMyImportStatus>) {
  window[STORAGE_KEY].api = {
    upsert: (data: OhMyAPIUpsert, context?: IOhMyContext): Promise<IOhMyStatus> => {
      const id = uniqueId();

      return new Promise<IOhMyStatus>(resolve => {
        updates$.pipe(
          filter(r => r.id === id),
          first(),
          map(output => ({
            status: output.status === 0 ? 'success' : 'failure'
          } as IOhMyStatus))
        ).subscribe(out => {
          resolve(out);
        });

        send({
          id,
          type: payloadType.UPSERT,
          context: {
            key: window.location.host,
            active: true,
            ...context
          } as IOhMyDomainContext,
          data,
          description: 'external-api:upsert'
        });
      })
    }
  }
}
