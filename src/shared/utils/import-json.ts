import { IOhMyImportStatus } from '../packet-type';
import { IData, IMock, IOhMyBackup, IOhMyContext, IState } from '../type';
import { DataUtils } from './data';
import { MigrateUtils } from './migrate';
import { StateUtils } from './state';
import { StorageUtils } from './storage';

export enum ImportResultEnum {
  SUCCESS, TOO_OLD, MIGRATED, ERROR
}

export async function importJSON(data: IOhMyBackup, context: IOhMyContext, sUtils = StorageUtils): Promise<IOhMyImportStatus> {
  const state = await sUtils.get<IState>(context.domain) || StateUtils.init(context);

  let status = ImportResultEnum.SUCCESS;
  let requests = data.requests as unknown as IData[];
  let responses = data.responses as unknown as IMock[];

  if (MigrateUtils.shouldMigrate({ version: data.version })) {
    requests = requests.map((r: IData) => {
      r.enabled = { ...r.enabled, [state.context.preset]: context.active };
      return MigrateUtils.migrate(r);
    }) as IData[];
    responses = data.responses.map(MigrateUtils.migrate) as IMock[];
  }

  if (requests[0]) { // migration succeeded!
    let timestamp = Date.now();

    for (let request of requests.sort((a, b) => a.lastHit > b.lastHit ? 1 : -1)) {
      request.lastHit = timestamp++; // make sure they each have a unique timestamp!
      request = DataUtils.prefilWithPresets(request, state.presets, context.active);
      state.data[request.id] = request;
    }

    for (const response of responses) {
      await sUtils.set(response.id, response);
    }

    await sUtils.set(state.domain, state);
  } else {
    status = ImportResultEnum.TOO_OLD;
  }

  return { status };
}
