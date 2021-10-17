import { uniqueId } from './unique-id';
import { IOhMyPresetChange, IOhMyPresets, ohMyPresetId } from '../type';

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
      return { id: uniqueId(), value: 'New preset' };
    }

    if (cloneFrom.match(IS_COPY_RE)) {
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
}
