// Modifiers

import { IOhMyRequest, IOhMyRequestId } from "./request";
import { IOhMyResponse, IOhMyResponseId } from "./response";

// Response
export interface IOhMyResponseDelete {
  requestId: IOhMyRequestId;
  responseId: IOhMyResponseId;
}

export type IOhMyResponseUpdate = Partial<IOhMyResponse> | IOhMyResponse[keyof IOhMyResponse];
export interface IOhMyResponseUpsert {
  response?: IOhMyResponseUpdate;
  responseId?: IOhMyResponseId; // Id is a seperate value because `response` can be just a value for update
  request: IOhMyRequestId | Partial<IOhMyRequest>;
}

// Request
export interface IOhMyRequestDelete {
  requestId: IOhMyRequestId;
}

export interface IOhMyRequestUpsert {
  update: Partial<IOhMyRequest>;
  requestId: IOhMyRequestId;
}

// Domain
