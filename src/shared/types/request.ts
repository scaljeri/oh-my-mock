import { objectTypes } from "../constants";
import { IOhMyResponse, IOhMyResponseId, IOhMyStatusCode } from "./response";

export type IOhMyRequestId = string;
export type IOhMyBodyId = string;
export type IOhMyRequestMethod = 'GET' | 'POST' | 'DELETE' | 'UPDATE' | 'PUT';
// export type IOhMyRequestType = 'XHR' | 'FETCH';

export interface IOhMyRequestPreset {
  isActive?: boolean;
  responseId?: IOhMyResponseId;
  bodyId?: IOhMyBodyId;
}

export interface IOhMyRequest {
  id: IOhMyRequestId;
  presets: Record<IOhMyRequestId, IOhMyRequestPreset>;

  // selected: Record<ohMyPresetId, IOhMyResponseId>;
  // enabled: Record<ohMyPresetId, boolean>;
  // requestType: requestType;
  responses: Record<IOhMyResponseId, IOhMyShallowResponse>;
  lastHit: number;
  lastModified: number;
  version: string;
  type: objectTypes.REQUEST;
  requestMethod: IOhMyRequestMethod
  url?: string;
}

export interface IOhMyShallowResponse {
  id: IOhMyResponseId;
  label?: string;
  modifiedOn?: string;
  statusCode: IOhMyStatusCode;
}

export interface IOhMyRequestContext {
  url?: string;
  method?: IOhMyRequestMethod;
  id?: IOhMyRequestId;
  responseId?: IOhMyResponseId;
}

