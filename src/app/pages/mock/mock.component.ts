import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Select } from '@ngxs/store';
import { IData, IState, statusCode } from '@shared/type';
import { Observable, Subscription } from 'rxjs';
import { UpdateDataStatusCode } from 'src/app/store/actions';
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
  @Dispatch() updateActiveStatusCode = (statusCode: statusCode) =>
    new UpdateDataStatusCode({
      url: this.data.url,
      method: this.data.method,
      type: this.data.type,
      statusCode
    });

  constructor(private activeRoute: ActivatedRoute) { }

  ngOnInit(): void {
    const index = Number(this.activeRoute.snapshot.params.mockIndex);

    this.subscription = this.state$.subscribe((state: IState) => {
      this.data = state.data[index];

      //Check if it is possible to select a mock by default
      if (this.data.activeStatusCode === 0) {
        const keys = Object.keys(this.data?.mocks);

        if (keys.length === 1 && !this.data.mocks[keys[0]].modifiedOn) {
          this.updateActiveStatusCode(Number(keys[0]));
        }
      }
    })
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
