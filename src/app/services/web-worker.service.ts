import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { IData } from '@shared/type';
import { loadAllMocks } from '@shared/utils/load-all-mocks';
import { OhMyStateService } from './state.service';
import { OhWWPacketTypes } from '../webworkers/types';
import { uniqueId } from '@shared/utils/unique-id';

@Injectable({
  providedIn: 'root'
})
export class WebWorkerService {
  private worker: Worker;
  private searchSubject = new Subject<string[]>();
  public searchResults = this.searchSubject.asObservable();

  constructor(private stateService: OhMyStateService) {
    stateService.response$.subscribe(update => {
      // TODO
    });
  }

  public async init(domain: string): Promise<void> {
    if (!this.worker) {
      this.worker = new Worker(new URL('../webworkers/search.worker', import.meta.url), { type: 'module' });
    }
    this.worker.postMessage({ type: OhWWPacketTypes.INIT, body: null });

    this.worker.postMessage({
      type: OhWWPacketTypes.MOCKS,
      body: await loadAllMocks(domain).then(data => {
        setTimeout(() => {
          this.worker.postMessage({ type: OhWWPacketTypes.INIT_DONE, body: null });
        });
        return data
      })
    });
  }

  public async search(terms: string[], data?: Record<string, IData>): Promise<string[]> {
    const id = uniqueId();

    this.worker.postMessage({ id, type: OhWWPacketTypes.SEARCH, body: { terms, data } });

    return new Promise<string[]>(resolve => {
      this.worker.onmessage = ({ data }) => {
        if (id === data.id) {
          resolve(data.body);
        }
      };
    })
  }
}
