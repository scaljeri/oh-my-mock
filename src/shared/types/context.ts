import { contextTypes } from "../constants";
import { IOhMyDomainId } from "./domain";
import { IOhMyPresetId } from "./preset";

export type IOhMyContext =
  IOhMyDomainContext
  | IOhMyPropertyContext

export interface IOhMyDomainContext {
  type: contextTypes.DOMAIN;
  domain: IOhMyDomainId;
  presetId?: IOhMyPresetId;
  active?: boolean;
  id?: string;
}

export interface IOhMyPropertyContext {
  key?: string;
  type: contextTypes.PROPERTY;
  path: string;
  propertyName: string;
}
