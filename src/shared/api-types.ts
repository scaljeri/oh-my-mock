import { IOhMyBackup } from "./types";

export type OhMyAPIUpsert = IOhMyBackup;

// export interface IOhMyUpsertContext {
//   active?: boolean;
//   preset?: string;
// }

export interface IOhMyMockSettings {
  active?: boolean; // Activate OhMyMock
  blurImages?: boolean;
}

export interface IOhMyStatus {
  status: 'success' | 'failure';
}
