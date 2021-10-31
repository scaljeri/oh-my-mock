import { Component, ElementRef, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IData, IOhMyContext, IState } from '@shared/type';
import { StateUtils } from '@shared/utils/state';
import { Subscription } from 'rxjs';
import { OhMyState } from 'src/app/services/oh-my-store';
import { OhMyStateService } from 'src/app/services/state.service';

// import { findAutoActiveMock } from 'src/app/utils/data';

@Component({
  selector: 'oh-my-page-mock',
  templateUrl: './mock.component.html',
  styleUrls: ['./mock.component.scss']
})
export class PageMockComponent implements OnInit {
  static StateUtils = StateUtils;
  public data: IData;
  private subscription: Subscription;
  public context: IOhMyContext;

  // @Dispatch() upsertData = (data: IData) => new UpsertData({ id: this.data.id, ...data }, this.context);

  constructor(private element: ElementRef,
    private activeRoute: ActivatedRoute,
    private stateService: OhMyStateService,
    private storeService: OhMyState) {}

  ngOnInit(): void {
    this.element.nativeElement.parentNode.scrollTop = 0;
    const dataId = this.activeRoute.snapshot.params.dataId;

    this.subscription = this.stateService.state$.subscribe((state: IState) => {
      this.data = PageMockComponent.StateUtils.findData(state, { id: dataId });
      this.context = state.context;
      // this.data = findMocks(state, { id: dataId });
      // if (!this.data.activeMock && Object.keys(this.data.mocks).length) {
      // const mockId = findAutoActiveMock(this.data);

      // if (mockId) {
      //   this.upsertData({ enabled: true, activeMock: mockId });
      // }
      // }
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
