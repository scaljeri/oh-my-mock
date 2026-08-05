import { uniqueId } from './unique-id';
import { IOhMyContext, IOhMyCookie, IOhMyPresetChange, IOhMyPresets, IOhMyRequests, IState, ohMyCookieId, ohMyPresetId } from '../type';

/** The cookie mocks of a domain, keyed by id — the shape `StorageUtils.getMany` hands back. */
export type IOhMyCookieRecords = Record<ohMyCookieId, IOhMyCookie>;

const IS_COPY_RE = /copy(\s\d+)?/;

export type OhMyScenarios = Record<ohMyPresetId, string>;

export class PresetUtils {
  static add(presets: IOhMyPresets, newId: ohMyPresetId, value: string): IOhMyPresets {
    const exists = Object.values(presets).find(v => v.toLowerCase() === value.toLowerCase());

    if (exists) {
      return presets;
    }

    return { ...presets, [newId]: value };
  }

  static findId(presets: IOhMyPresets, value: string): ohMyPresetId | undefined {
    return Object.entries(presets)
      .find(([, v]) => v.toLowerCase() === value.toLowerCase())?.[0];
  }

  static create(presets: IOhMyPresets, cloneFrom: string): IOhMyPresetChange {
    let newValue = '';
    let count = 0;

    if (!cloneFrom) {
      newValue = 'New Preset'
      if (!this.findId(presets, newValue)) {
        return { id: uniqueId(), value: newValue };
      }
      newValue += ' copy';
    } else if (cloneFrom.match(IS_COPY_RE)) {
      count = Number(RegExp.$1 || 0) + 1;
      newValue = cloneFrom.replace(IS_COPY_RE, 'copy');
    } else {
      newValue = `${cloneFrom} copy`;
    }

    while (this.findId(presets, `${newValue}${count === 0 ? '' : ` ${count}`}`)) {
      count++;
    }
    newValue += `${count === 0 ? '' : ` ${count}`}`;

    return { id: uniqueId(), value: newValue };
  }

  static update(id: ohMyPresetId, value: string, presets: IOhMyPresets): IOhMyPresets {
    return { ...presets, [id]: value };
  }

  /**
   * Drops a preset from a state, from each of its requests and from each of its
   * cookie mocks.
   *
   * The requests and cookies are separate storage records now, so they come in
   * and go out next to the state: the caller writes back the state and every
   * record this touched. A cookie it did not touch keeps its identity, so the
   * caller can tell the two apart and skip the write.
   */
  static delete(state: IState, requests: IOhMyRequests, cookies: IOhMyCookieRecords, id: ohMyPresetId):
    { state: IState, requests: IOhMyRequests, cookies: IOhMyCookieRecords } {
    const retVal = {
      ...state,
      presets: { ...state.presets },
      context: { ...state.context }
    };

    const retRequests: IOhMyRequests = { ...requests };
    const retCookies: IOhMyCookieRecords = { ...cookies };

    state.requests.forEach(requestId => {
      const request = requests[requestId];

      if (!request) { // not loaded, or already removed
        return;
      }

      const clone = {
        ...request,
        selected: { ...request.selected },
        enabled: { ...request.enabled }
      };

      delete clone.selected[id];
      delete clone.enabled[id];

      retRequests[clone.id] = clone;
    });

    // `IOhMyCookie.enabled` is keyed by preset id just like a request's, and
    // used to be skipped here — the exact bug this method already fixed for
    // requests. The key is set to `false` rather than removed: cookie records
    // are written back through the cookie handler, which merges `enabled` per
    // key (so a partial update cannot wipe the other presets), and a merge can
    // never *drop* a key. An explicit `false` is the strongest statement that
    // channel can carry, and it is indistinguishable from an absent key at
    // every read site — `enabled[preset]` is only ever read for truthiness,
    // and a new preset starts with every cookie off anyway. What matters is
    // that a future preset reusing this id can no longer inherit `true`.
    (state.cookies ?? []).forEach(cookieId => {
      const cookie = cookies[cookieId];

      if (!cookie || !(id in cookie.enabled)) { // not loaded, gone, or never knew the preset
        return;
      }

      retCookies[cookieId] = { ...cookie, enabled: { ...cookie.enabled, [id]: false } };
    });

    if (state.context.preset === id) {
      delete (retVal.context as Partial<IOhMyContext>).preset;
    }

    delete retVal.presets[id];

    return { state: retVal, requests: retRequests, cookies: retCookies };
  }
}
