export type ohMyPresetId = string;

/** A domain's presets: id to the label shown in the popup. */
export type IOhMyPresets = Record<ohMyPresetId, string>

export interface IOhMyPresetChange {
  id: string,
  value: string
}
