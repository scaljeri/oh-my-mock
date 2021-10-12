import { Injectable } from '@angular/core';
import { IOhMyContext, ohMyDomain } from '@shared/type';

const VERSION = '__OH_MY_VERSION__';

@Injectable({
  providedIn: 'root'
})
export class ContextService implements IOhMyContext {
  public version = VERSION;
  public domain: ohMyDomain;
  public preset: string;

  update(context: IOhMyContext): void {
    if (context) {
      Object.entries(context).forEach(([k, v]) => this[k] = v);
    }
  }
}
