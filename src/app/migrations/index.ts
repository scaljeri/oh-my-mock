import { migrate as v2121 } from './v2.12.1';
import { IOhMyMock } from '@shared/type'

import { IOhMygration } from './types';


export const migrations: Record<string, IOhMygration> = {
  '2.5.0': (state: IOhMyMock) => null, // reset
  '2.12.1': v2121
}

export * from './types';
