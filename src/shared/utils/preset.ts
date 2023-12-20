import { uniqueId } from './unique-id';
import { IOhMyDomain, IOhMyDomainPresets, IOhMyPreset, IOhMyPresetId, IOhMyRequest, IOhMyRequestId } from '../types';
import { StorageUtils } from './storage';

const IS_COPY_RE = /copy(\s\d+)?/;

export type OhMyScenarios = Record<IOhMyPresetId, string>;

export class PresetUtils {
  static add(presets: IOhMyDomainPresets, newId: IOhMyPresetId, label: string): IOhMyDomainPresets {
    const exists = Object.values(presets).find(v => v.label.toLowerCase() === label.toLowerCase());

    if (exists) {
      return presets;
    }

    return { ...presets, [newId]: { label } } as IOhMyDomainPresets;
  }

  static findId(presets: IOhMyDomainPresets, value: string): IOhMyPresetId | undefined {
    return Object.entries(presets)
      .find(([, v]) => v.label.toLowerCase() === value.toLowerCase())?.[0];
  }

  static create(presets: IOhMyDomainPresets, cloneFrom: string): IOhMyPreset {
    let label = 'New Preset';
    let count = 0;

    if (cloneFrom) {
      const m = cloneFrom.match(IS_COPY_RE);
      if (m) {
        count = Number(m[1] || 0) + 1;
        label = cloneFrom.replace(IS_COPY_RE, 'copy');
      } else {
        label = `${cloneFrom} copy`;
      }
    }

    while (this.findId(presets, `${label}${count === 0 ? '' : ` ${count}`}`)) {
      count++;
    }
    label += `${count === 0 ? '' : ` ${count}`}`;

    return { id: uniqueId(), label };
  }

  static update(id: IOhMyPresetId, label: string, presets: IOhMyDomainPresets): IOhMyDomainPresets {
    return { ...presets, [id]: { label } } as IOhMyDomainPresets;
  }

  static async delete(domain: IOhMyDomain, id: IOhMyPresetId): Promise<IOhMyDomain> {
    const retVal = {
      ...domain,
      requests: { ...domain.requests },
      presets: { ...domain.presets },
      context: { ...domain.context }
    } as IOhMyDomain;

    for (const requestId of retVal.requests) {
      const request = await StorageUtils.get<IOhMyRequest>(requestId);
      const clone = { ...request, presets: { ...request.presets } };

      delete clone.presets[id];
      await StorageUtils.set(requestId, clone);
    }

    if (domain.context.presetId === id) {
      delete retVal.context.presetId;
    }

    delete retVal.presets[id];

    return retVal;
  }
}
