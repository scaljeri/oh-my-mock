import { IOhMyPacketContext, IPacketPayload } from "../../shared/packet-type";
import { IData, IOhMyMock, IState } from "../../shared/type";
import { update } from "../../shared/utils/partial-updater";
import { StateUtils } from "../../shared/utils/state";
import { StorageUtils } from "../../shared/utils/storage";
import { StoreUtils } from "../../shared/utils/store";
import { ensureGroups } from "../ensure-groups";
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
      // Is the state new, add it to the store
      let store = await OhMyStateHandler.StorageUtils.get<IOhMyMock>();

      if (!StoreUtils.hasState(store, domain)) {
        store = StoreUtils.setState(store, state);
        // A domain that is new here needs the local group its mocks belong to.
        // `initStorage` only runs at worker start and on reset, so a domain
        // that comes into being afterwards — the popup's "Add domain", a site
        // being activated — would otherwise never get one, and the sidebar
        // would show it as having no groups for ever.
        store = await ensureGroups(store);

        await OhMyStateHandler.StorageUtils.setStore(store);
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
