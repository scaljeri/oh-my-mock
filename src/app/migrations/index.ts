import { IOhMygration } from './types';


export const migrations: Record<string, IOhMygration> = {
  // A reset: the stored state is discarded rather than transformed, so the
  // migration ignores what it is handed.
  '2.13.0': () => null

}

export * from './types';
