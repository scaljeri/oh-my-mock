import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Select } from '@ngxs/store';
import { IData, IState, ohMyMockId } from '@shared/type';
import { findActiveData } from '@shared/utils/find-mock';
import { Observable, Subscription } from 'rxjs';
import { UpdateDataResponse } from 'src/app/store/actions';
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
  @Dispatch() updateActiveStatusCode = (mockId: ohMyMockId) =>
    new UpdateDataResponse({
      id: this.data.id,
      mockId
    });

  constructor(private activeRoute: ActivatedRoute) { }

  ngOnInit(): void {
    const dataId = this.activeRoute.snapshot.params.dataId;

    this.subscription = this.state$.subscribe((state: IState) => {
      this.data = findActiveData(state, { id: dataId });

      // Check if it is possible to select a mock by default
      // if (!this.data.activeStatusCode) {
      //   const keys = Object.keys(this.data?.mocks);

      //   if (keys.length === 1 && !this.data.mocks[keys[0]].modifiedOn) {
      //     this.updateActiveStatusCode(Number(keys[0]));
      //   }
      // }
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
