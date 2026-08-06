import { Injectable, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { IData, IMock, ohMyDataId } from '@shared/type';
import { loadAllMocks } from '@shared/utils/load-all-mocks';
import { OhMyStateService } from './state.service';
import { OhWWPacketTypes } from '../webworkers/types';
import { uniqueId } from '@shared/utils/unique-id';
import {
  OH_MY_SEARCH_WORKER_FACTORY,
  SearchWorkerFactory
} from './search-worker.token';

@Injectable({
  providedIn: 'root'
})
export class WebWorkerService {
  private stateService = inject(OhMyStateService);
  private createWorker = inject<SearchWorkerFactory>(
    OH_MY_SEARCH_WORKER_FACTORY
  );

  private worker!: Worker;
  private searchSubject = new Subject<string[]>();
  public searchResults = this.searchSubject.asObservable();

  private mockUpsertSubject = new Subject();
  public mockUpsert$ = this.mockUpsertSubject.asObservable();

  public async init(domain: string): Promise<void> {
    if (!this.worker) {
      this.worker = this.createWorker();

      // Subscribed once, with the worker, not once per `init`. This runs on
      // every domain switch, and each call used to add another subscription —
      // after visiting N domains every response update was posted to the
      // worker N times. The worker lives for the popup, and so does this.
      this.stateService.response$.subscribe((mock) => this.upsertMock(mock));
    }
    this.worker.postMessage({ type: OhWWPacketTypes.INIT, body: null });

    this.worker.postMessage({
      type: OhWWPacketTypes.MOCKS,
      body: await loadAllMocks(domain).then((data) => {
        setTimeout(() => {
          this.worker.postMessage({
            type: OhWWPacketTypes.INIT_DONE,
            body: null
          });
        });
        return data;
      })
    });
  }

  public upsertMock(mock: IMock): void {
    this.worker.postMessage({
      type: OhWWPacketTypes.MOCKS,
      body: { [mock.id]: mock }
    });

    this.mockUpsertSubject.next(mock);
  }

  public search(
    data: Record<ohMyDataId, IData>,
    terms: string[],
    includes: Record<string, boolean>
  ): Observable<string[]> {
    const id = uniqueId();

    this.worker.postMessage({
      id,
      type: OhWWPacketTypes.SEARCH,
      body: { terms, data, includes }
    });

    return new Observable<string[]>((observer) => {
      this.worker.onmessage = ({ data }) => {
        if (id === data.id) {
          observer.next(data.body);
          observer.complete();
        }
      };
    });
  }
}
