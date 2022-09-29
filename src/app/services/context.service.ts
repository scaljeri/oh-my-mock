import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { share } from 'rxjs/operators';
import { contextTypes } from '../../shared/constants';
import { IOhMyDomainContext, IOhMyDomainId } from '../../shared/types';

const VERSION = '__OH_MY_VERSION__';

@Injectable({
  providedIn: 'root'
})
export class ContextService implements IOhMyDomainContext {
  readonly type = contextTypes.DOMAIN;
  public version = VERSION;
  public domain: IOhMyDomainId;
  public preset: string;

  private subject = new BehaviorSubject<IOhMyDomainContext>(this);
  public stream$ = this.subject.asObservable().pipe(share());

  update(context: Partial<IOhMyDomainContext>): void {
    if (context) {
      Object.entries(context).forEach(([k, v]) => this[k] = v);
      this.subject.next(this);
    }
  }
}
