import { uniqueId } from './unique-id';
import { IOhMyContext, IOhMyPresetChange, IOhMyPresets, IOhMyRequests, IState, ohMyPresetId } from '../type';

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
   * Drops a preset from a state and from each of its requests.
   *
   * The requests are separate storage records now, so they come in and go out
   * next to the state: the caller writes back both the state and every request
   * this touched.
   */
  static delete(state: IState, requests: IOhMyRequests, id: ohMyPresetId): { state: IState, requests: IOhMyRequests } {
    const retVal = {
      ...state,
      presets: { ...state.presets },
      context: { ...state.context }
    };

    const retRequests: IOhMyRequests = { ...requests };

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

    if (state.context.preset === id) {
      delete (retVal.context as Partial<IOhMyContext>).preset;
    }

    delete retVal.presets[id];

    return { state: retVal, requests: retRequests };
  }
}
