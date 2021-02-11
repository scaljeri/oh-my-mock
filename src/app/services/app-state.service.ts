import { Injectable } from '@angular/core';
import { IResponses } from '../store/type';

@Injectable({
  providedIn: 'root'
})
export class AppStateService {
  responses: IResponses;

  setResponses(responses: IResponses): void {
    this.responses = responses;
  }
}
