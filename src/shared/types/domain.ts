import { objectTypes } from "../constants";
import { IOhMyPreset, IOhMyPresetId } from "./preset";
import { IOhMyRequestId } from "./request";

// URL of the website
export type IOhMyDomainId = string;

export interface IOhMyDomain {
  version: string;
  name?: string;
  type: objectTypes.DOMAIN;
  domain: IOhMyDomainId;
  requests: IOhMyRequestId[];
  aux: IOhMyAux;
  presets: Record<IOhMyPresetId, IOhMyPreset>;
  context: IOhMyContext;
  modifiedOn?: string;
}

export type IOhMyDomainPresets = Record<IOhMyPresetId, IOhMyPreset>;

export interface IOhMyAux {
  filterKeywords?: string;
  newAutoActivate?: boolean;
  appActive?: boolean;
  blurImages?: boolean;
  filteredRequests?: IOhMyRequestId[]
  filterOptions?: Record<string, boolean>;
}

export interface IOhMyContext {
  domain: IOhMyDomainId;
  presetId?: IOhMyPresetId;
  active?: boolean;
  id?: string;
}
