import { IOhMyMock, IState } from '../../shared/type';

export class MigrationUtils {
  static version: string;

  static update<T>(store: T, version = MigrationUtils.version): T | null {
    return store;
  }

  static requireUpdate(store: IOhMyMock | IState, version = MigrationUtils.version): boolean {
    return true;
  }
}
