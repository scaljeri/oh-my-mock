import { OhMyAPIUpsert } from "../../shared/api-types";
import { IOhMyPacketContext, IPacketPayload } from "../../shared/packet-type";
import { importJSON, ImportResultEnum, IOhMyImportResult } from "../../shared/utils/import-json";
import { StorageUtils } from "../../shared/utils/storage";
import { error } from "../utils";
import { wipeIsPending } from "../wipe-barrier";

/**
 * Imports a backup, for everyone who has one: the public API's `upsert`, the
 * `.json` import dialog and the HAR import dialog.
 *
 * The two dialogs used to call `importJSON` in the popup's own process, and
 * that is what this handler exists to stop. `wipe-barrier.ts` keeps a full
 * reset apart from everything else by holding the message queue's intake shut
 * and waiting for every lane to fall quiet — and it can only see work that came
 * through that door. A write from another process is invisible to it, so an
 * import racing a reset left exactly the records the barrier was built to
 * prevent: mocks with no request, requests no state names, a state for a domain
 * the rebuilt store has never heard of.
 *
 * Running here puts the import behind the door with everything else. The reset
 * wins — a reset that arrives mid-import waits for it and then deletes what it
 * wrote — and the sender is told so rather than being handed a success for
 * records that no longer exist.
 *
 * ## Why a mid-flight import is finished rather than abandoned
 *
 * "The reset wins" is satisfied either way: whether the import stops halfway or
 * runs to the end, the clear deletes every record it wrote. Letting it finish
 * is the version that costs nothing and risks nothing.
 *
 * - It buys no time. The wipe cannot start until this handler returns — the
 *   barrier counts it as work and `quiet()` waits for it — so abandoning early
 *   would only make the *answer* earlier, by however long the remaining
 *   `StorageUtils.set` calls take. Nothing the user sees happens sooner.
 * - It would need a cancellation flag threaded through `importJSON` past every
 *   `await`: the reads, the response loop, the request loop, the cookie loop.
 *   That is the same mechanism `wipe-barrier.ts` rejected for the generation
 *   counter, for the same reason — every place that forgets to check it is a
 *   hole that looks exactly like working code.
 * - It would be checked in a function that also runs *inside* the wipe. The
 *   demo import at the end of `resetEverything`, and the one at start-up, both
 *   call `importJSON` with a wipe pending by construction; a cancel-on-pending
 *   -wipe check there would abandon the rebuild the reset exists to perform and
 *   leave the extension with an empty store.
 * - A half-written import is only harmless while the wipe is certain to happen.
 *   `resetEverything` catches its own failures, so a clear that throws leaves
 *   whatever the import had written — and a complete import is a consistent
 *   set of records, while an abandoned one is the stranded mocks and unlisted
 *   requests this whole barrier was built to stop.
 */
export class OhMyImportHandler {
  static StorageUtils = StorageUtils;

  /**
   * The counts travel back with the status.
   *
   * This used to answer `IOhMyImportStatus`, which is all the public API needs
   * — it maps everything but SUCCESS to 'failure'. The import dialogs need
   * more: their whole success toast is "Imported N requests and M responses",
   * and those numbers count what was *stored*, which a partly-too-old backup
   * makes smaller than what the file held. Dropping them here would have left
   * the popup either lying about the file's own counts or saying nothing.
   *
   * The UPSERT packet also comes from the public API (`src/injected/api.ts`),
   * which only sends a domain — there is no preset in an API call.
   */
  static async upsert(payload: IPacketPayload<OhMyAPIUpsert, IOhMyPacketContext>): Promise<IOhMyImportResult> {
    const failed: IOhMyImportResult = { status: ImportResultEnum.ERROR, requests: 0, responses: 0 };

    try {
      const { data, context } = payload;

      if (!data || !context) { // Nothing to import, or nowhere to import it to
        return failed;
      }

      const result = await importJSON(
        data,
        // `importJSON` only reads `domain` and `active`; the preset it imports
        // into is the one on the state, which is 'default' for a new domain.
        { active: true, ...context, preset: context.preset ?? 'default' },
        OhMyImportHandler.StorageUtils);

      if (result.status === ImportResultEnum.SUCCESS && wipeIsPending()) {
        // Everything above was written, and a reset asked for while it was
        // being written is still waiting for this handler to return — the
        // barrier counts this unit of work, so the wipe has not run yet and is
        // next. Every record just written is condemned, and the sender is about
        // to put "Imported N requests and M responses" on screen over a domain
        // that will not exist a moment later.
        //
        // Zeroed rather than passed through: the counts say what was stored,
        // and after the wipe nothing was. A reset whose own clear then throws
        // would leave these records alive after all and make this answer
        // pessimistic — which is the safe direction to be wrong in, since the
        // user is told to import again rather than told to trust records that
        // are gone.
        return { status: ImportResultEnum.DISCARDED, requests: 0, responses: 0 };
      }

      return result;
    } catch (err) {
      // The queue answers the caller with whatever comes back, so a failed
      // import has to resolve as an ERROR rather than reject — but it must not
      // do so silently, which is what the empty `catch` (and the empty
      // `finally` behind it) amounted to.
      error('Could not import the backup', err);

      return failed;
    }
  }
}
