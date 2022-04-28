import { IData, IMock } from "@shared/type";

export enum OhWWPacketTypes {
  INIT = 'INIT',
  INIT_DONE = 'INIT_DONE',
  MOCKS = 'MOCKS',
  SEARCH = 'SEARCH',
  SEARCH_RESULT = 'SEARCH_RESULT'
}

export type IOhWWPacketMocks = Record<string, IMock>;
export interface IOhWWPacket<T = unknown> {
  type: OhWWPacketTypes;
  id: string;
  body: T
}

export interface IOhWWPacketSearch {
  id: string;
  terms: string[];
  data: Record<string, IData>;
}
