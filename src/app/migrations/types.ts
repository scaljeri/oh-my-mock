import { IOhMyMock } from '@shared/type';

// A migration may return null when the store cannot be migrated at all.
export type IOhMygration = (state: IOhMyMock) => IOhMyMock | null;
export type IOhMygrations = Record<string, IOhMygration>;
