import { IOhMyMock } from '@shared/type';

export type IOhMygration = (state: IOhMyMock) => IOhMyMock;
export type IOhMygrations = Record<string, IOhMygration>;
