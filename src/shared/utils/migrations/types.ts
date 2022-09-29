import { IOhMyMock } from '../../types';

export type IOhMygration = (state: IOhMyMock) => IOhMyMock;
export type IOhMygrations = Record<string, IOhMygration>;
