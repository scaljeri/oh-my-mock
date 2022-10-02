// Modifiers

import { IOhMyRequest, IOhMyRequestId } from "./request";
import { IOhMyResponse, IOhMyResponseId } from "./response";

// Response
export interface IOhMyResponseDelete {
  requestId: IOhMyRequestId;
  responseId: IOhMyResponseId;
}

export interface IOhMyResponseUpsert {
  update: Partial<IOhMyResponse> | IOhMyResponse[keyof IOhMyResponse]
  responseId: IOhMyResponseId;
  requestId?: IOhMyRequestId;
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
