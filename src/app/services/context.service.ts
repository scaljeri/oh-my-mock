import { Injectable } from '@angular/core';
import { IOhMyContext, ohMyDomain } from '@shared/type';
import { BehaviorSubject } from 'rxjs';
import { share } from 'rxjs/operators';

const VERSION = '__OH_MY_VERSION__';

@Injectable({
  providedIn: 'root'
})
export class ContextService implements IOhMyContext {
  public version = VERSION;
  public domain: ohMyDomain;
  public preset: string;

  private subject = new BehaviorSubject<IOhMyContext>(this);
  public stream$ = this.subject.asObservable().pipe(share());

  update(context: Partial<IOhMyContext>): void {
    if (context) {
      Object.entries(context).forEach(([k, v]) => this[k] = v);
      this.subject.next(this);
    }
  }
}
