import { Component, OnInit } from '@angular/core';
import { Select } from '@ngxs/store';
import { domain, IOhMyMock } from '@shared/type';
import { Observable } from 'rxjs';
import { OhMyState } from 'src/app/store/state';

@Component({
  selector: 'app-state-explorer',
  templateUrl: './state-explorer.component.html',
  styleUrls: ['./state-explorer.component.scss']
})
export class StateExplorerComponent implements OnInit {
  @Select(OhMyState.getState) state$: Observable<IOhMyMock>;

  domains: domain[];

  constructor() { }

  ngOnInit(): void {
    this.state$.subscribe(state => {
      this.domains = Object.keys(state.domains);
    });
  }

}
