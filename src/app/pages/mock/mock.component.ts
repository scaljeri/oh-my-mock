import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Select } from '@ngxs/store';
import { IData, IState } from '@shared/type';
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

  @Select(OhMyState.mainState) state$: Observable<IState>;

  constructor(private activeRoute: ActivatedRoute) { }

  ngOnInit(): void {
    const index = Number(this.activeRoute.snapshot.params.mockIndex);

    this.subscription = this.state$.subscribe((state: IState) => {
      this.data = state.data[index];
    })
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
