import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Select, Store } from '@ngxs/store';
import { IData, IMock, IOhMyMock } from '@shared/type';
import { Observable, Subscription } from 'rxjs';
import { OhMyState } from 'src/app/store/state';

@Component({
  selector: 'oh-my-page-mock',
  templateUrl: './mock.component.html',
  styleUrls: ['./mock.component.scss']
})
export class PageMockComponent implements OnInit {
  public data: IData;
  private subscription: Subscription;

  @Select(OhMyState) state$: Observable<IOhMyMock>;

  constructor(
    private activeRoute: ActivatedRoute,
    private store: Store) { }

  ngOnInit(): void {
    const index = Number(this.activeRoute.snapshot.params.mockIndex);
    const domain = decodeURIComponent(this.activeRoute.snapshot.params.domain || '');

    this.subscription = this.state$.subscribe((state: IOhMyMock) => {
      const activeState = domain ? state.domains[domain] : OhMyState.getActiveState(state);
      this.data = activeState.data[index];
    })
  }
}
