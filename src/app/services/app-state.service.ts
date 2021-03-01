import { Injectable } from '@angular/core';
import { IData } from '../../shared/type';

@Injectable({
  providedIn: 'root'
})
export class AppStateService {
  responses: IData;

  setResponses(responses: IData): void {
    this.responses = responses;
  }
}
