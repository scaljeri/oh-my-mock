import { IData } from '@shared/types/request';

export interface IOhDataView extends IData {
  /** `displayUrl` when there is one, `url` otherwise — see `toRow`. */
  shownUrl: string;
  urlStart: string;
  urlEnd: string;
}
