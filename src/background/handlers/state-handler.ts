import { IOhMyPacketContext, IPacketPayload } from "../../shared/packet-type";
import { IData, IOhMyMock, IState } from "../../shared/type";
import { update } from "../../shared/utils/partial-updater";
import { StateUtils } from "../../shared/utils/state";
import { StorageUtils } from "../../shared/utils/storage";
import { StoreUtils } from "../../shared/utils/store";
import { isForgotten, rememberDomain } from "../forgotten-domains";
import { mutateStore } from "../store-writer";
import { error } from "../utils";

export class OhMyStateHandler {
  static StorageUtils = StorageUtils;

  static async update(payload: IPacketPayload<IState | IData | unknown, IOhMyPacketContext>): Promise<IState | undefined> {
    try {
      const { data, context } = payload;
      // A full state carries its own domain, and **that** is the one to write it
      // under. The packet context names the domain the popup is looking at,
      // which `OhMySendToBg.full` fills in whether or not the caller asked for
      // it — so preferring it meant a state created for somewhere else was
      // stored over the state of wherever you happened to be. "Add domain" did
      // exactly that: the new domain was never created, and the mocks of the
      // one on screen were replaced by an empty state.
      //
      // A patch is the other way round: `data` is the value being patched in,
      // not a state, so only the context can say where it belongs.
      // `path` and `propertyName` are what a patch *is*; `kind` is the label on
      // it. Going by the label alone made a mislabelled patch destructive:
      // `response-handler` built one without `kind` and the whole domain state
      // — presets, aux, context, the request list — was replaced by the array
      // it meant to patch in. TypeScript could not see it, because the excess
      // property check against a union admits `path`/`propertyName` from the
      // other constituent.
      //
      // So the shape decides, and the label is accepted as a second opinion.
      const isPatch =
        !!context &&
        (context.kind === 'patch' ||
          ('path' in context && 'propertyName' in context));
      const domain =
        (!isPatch && StateUtils.isState(data) ? data.domain : undefined) ??
        context?.domain;

      if (!domain) {
        error('Cannot update a state without a domain', payload);
        return undefined;
      }

      let state: IState;

      if (isPatch) {
        state = await OhMyStateHandler.StorageUtils.get<IState>(domain) || StateUtils.init({ domain });
        state = update<IState>(context.path, state, context.propertyName, data);
      } else if (StateUtils.isState(data)) {
        state = data;
      } else if (!data) {
        state = StateUtils.init({ domain });
      } else {
        // Not a state, and not shaped like a patch either. Writing it would
        // replace everything the domain has with whatever this is — which is
        // exactly what used to happen. Refusing costs one lost update; the
        // alternative cost the domain.
        error('Refusing to store something that is not a state', payload);

        return undefined;
      }
      // Is the state new, add it to the store. The read here is a fast path and
      // nothing more — a state is written on every aux change, every filter
      // keystroke and every request the page makes, and joining the store's
      // write queue for each of them would cost a group pass apiece. What the
      // store *is* is decided inside `mutateStore`, which reads it again in its
      // own turn: this read can be stale, and acting on a stale one is how a
      // domain registered a moment earlier used to be dropped again.
      //
      // A domain that is new also needs the local group its mocks belong to.
      // `initStorage` only runs at worker start and on reset, so a domain that
      // comes into being afterwards — the popup's "Add domain", a site being
      // activated — would otherwise never get one, and the sidebar would show
      // it as having no groups for ever. `mutateStore` does that part.
      const known = await OhMyStateHandler.StorageUtils.get<IOhMyMock>();

      if (!StoreUtils.hasState(known, domain)) {
        // The domain exists again, so a tombstone left by an earlier "forget
        // this domain" has to go — otherwise a domain deleted and then visited
        // again would be refused its record for the rest of the browser
        // session, and mocking would silently do nothing on a site the user
        // had just added back.
        await rememberDomain(domain);

        await mutateStore(store =>
          StoreUtils.hasState(store, domain) ? undefined : StoreUtils.setState(store, state));
      } else if (await isForgotten(domain)) {
        // Listed a moment ago, forgotten since. This write was decided before
        // the removal ran and would put the record back for a domain that is
        // being unlisted — a state, and every request it names, left in
        // storage with nothing naming it. The list and the record live under
        // different storage keys and `chrome.storage` has no transaction
        // across them, so this is the only place the two can be kept in step
        // without putting every state write in the store's queue: a state is
        // written on every aux change, every filter keystroke and every
        // intercepted request. See `forgotten-domains.ts`.
        return undefined;
      }

      // if (state.aux.appActive && state.aux.popupActive) {
      //   cSPRemoval([payload.context.domain]);
      // }

      return StorageUtils.set(domain, state).then(() => state);
    } catch (err) {
      error('Could not update the state', err);
    }
  }
}
