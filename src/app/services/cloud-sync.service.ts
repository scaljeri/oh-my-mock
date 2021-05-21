import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CloudSyncService {
  private activitySubject = new BehaviorSubject<boolean>(false);
  public activity$ = this.activitySubject
  constructor() { }

  public activity(state: boolean): void {
    this.activitySubject.next(state);
  }
}
