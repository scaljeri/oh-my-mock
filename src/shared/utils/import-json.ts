import { IData, IMock, IOhMyBackup, IOhMyContext, IState } from '../type';
import { DataUtils } from './data';
import { MigrateUtils } from './migrate';
import { StateUtils } from './state';
import { StorageUtils } from './storage';

export enum ImportResultEnum {
  SUCCESS, TOO_OLD, MIGRATED, ERROR
}
export interface IOhMyImportResult {
  status: ImportResultEnum;
}

export async function importJSON(data: IOhMyBackup, context: IOhMyContext, { activate = false } = {}): Promise<IOhMyImportResult> {
  const state = await StorageUtils.get<IState>(context.domain) || StateUtils.init(context);

  let status = ImportResultEnum.SUCCESS;
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

    for (let request of requests.sort((a, b) => a.lastHit > b.lastHit ? 1 : -1)) {
      request.lastHit = timestamp++; // make sure they each have a unique timestamp!
      request = DataUtils.prefilWithPresets(request, state.presets);
      state.data[request.id] = request;
    }

    for (const response of responses) {
      await StorageUtils.set(response.id, response);
    }

    await StorageUtils.set(state.domain, state);
  } else {
    status = ImportResultEnum.TOO_OLD;
  }

  return { status };
}
