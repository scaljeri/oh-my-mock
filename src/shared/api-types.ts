import { IOhMyBackup } from "./type";

export type OhMyAPIUpsert = IOhMyBackup;

export interface IOhMyUpsertContext {
  activate?: boolean;
  preset?: string;
}

export interface IOhMyExternalSettings {
  activate?: boolean; // Activate OhMyMock
  blurImages?: boolean;
}

export interface IOhMyStatus {
  status: 'success' | 'failure';
}
