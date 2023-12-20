import { contextTypes } from "../constants";
import { IOhMyDomainId } from "./domain";
import { IOhMyPresetId } from "./preset";

export type IOhMyContext =
  IOhMyDomainContext
  | IOhMyPropertyContext

export interface IOhMyDomainContext {
  type: contextTypes.DOMAIN;
  key: IOhMyDomainId;
  presetId?: IOhMyPresetId;
  active?: boolean;
  id?: string;
}

export interface IOhMyPropertyContext {
  id?: string;
  key?: string; // The key used to retrieve the object from Storage
  type: contextTypes.PROPERTY;
  path: string;
  propertyName: string;
}
