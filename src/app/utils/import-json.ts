import { STORAGE_KEY } from '@shared/constants';
import { IData, IMock, IOhMyContext, IOhMyMock, IState } from '@shared/type';
import { DataUtils } from '@shared/utils/data';
import { MigrateUtils } from '@shared/utils/migrate';
import { StateUtils } from '@shared/utils/state';
import data from '../../assets/dummy-data.json';
import { StorageService } from '../services/storage.service';

export enum ImportResultEnum {
  SUCCESS, TOO_OLD, MIGRATED, ERROR
}
export interface IOhMyImportResult {
  status: ImportResultEnum;
}

export async function importJSON(storage: StorageService, context: IOhMyContext, activate = false): Promise<IOhMyImportResult> {
  const store = await storage.get<IOhMyMock>(STORAGE_KEY);
  let state = await storage.get<IState>(context.domain) || StateUtils.init(context);
  let status = ImportResultEnum.SUCCESS;

  if (!store.domains.includes(context.domain)) {
    store.domains = [context.domain, ...store.domains];
    await storage.set(STORAGE_KEY, store);
  }

  let requests = data.requests as unknown as IData[];
  let responses = data.responses as unknown as IMock[];

  if (MigrateUtils.shouldMigrate({ version: data.version })) {
    requests = requests.map((r: IData) => {
      r.enabled = { ...r.enabled, [state.context.preset]: activate };
      return MigrateUtils.migrate(r);
    }) as IData[];
    responses = data.responses.map(MigrateUtils.migrate) as IMock[];
  }

  if (requests[0]) { // migration succeeded!
    let timestamp = Date.now();
    requests.sort((a, b) => a.lastHit > b.lastHit ? 1 : -1).forEach(r =>  {
      r.lastHit = timestamp++; // make sure they each have a unique timestamp!
      r = DataUtils.prefilWithPresets(r, state.presets);
      state = StateUtils.setRequest(state, r)
    });
    await storage.set(state.domain, state);

    for (const response of responses) {
      await storage.set(response.id, response);
    }
  } else {
    status = ImportResultEnum.TOO_OLD;
  }

  return { status };
}
