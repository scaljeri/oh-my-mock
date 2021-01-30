import { Injectable } from '@angular/core';
import { Select, Store } from '@ngxs/store';
import { Observable } from 'rxjs';
import { OhMyState } from '../store/state';
import { IState } from '../store/type';
import { STORAGE_KEY } from '../types';

@Injectable({
  providedIn: 'root'
})

export class ContentService {
  private domain: string;



  constructor(private store: Store) {


 ;
  }
}
