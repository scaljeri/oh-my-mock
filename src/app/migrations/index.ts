import { IOhMyMock } from '../../shared/types';
import { IOhMygration } from './types';


export const migrations: Record<string, IOhMygration> = {
  '2.13.0': (state: IOhMyMock) => null // RESET

}

export * from './types';
