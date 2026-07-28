import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  inject
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  IData,
  IOhMyAux,
  IOhMyContext,
  IOhMyRequests,
  IState
} from '@shared/type';
import { StateUtils } from '@shared/utils/state';
import { combineLatest, Subscription } from 'rxjs';
import { OhMyStateService } from '../../services/state.service';
import { RequestComponent } from '../../components/request/request.component';

// import { findAutoActiveMock } from 'src/app/utils/data';

@Component({
  selector: 'oh-my-page-mock',
  templateUrl: './mock.component.html',
  styleUrls: ['./mock.component.scss'],
  imports: [RequestComponent]
})
export class PageMockComponent implements OnInit, OnDestroy {
  private element = inject(ElementRef);
  private activeRoute = inject(ActivatedRoute);
  private stateService = inject(OhMyStateService);
  private cdr = inject(ChangeDetectorRef);

  static StateUtils = StateUtils;
  public data!: IData;
  private subscription!: Subscription;
  public context!: IOhMyContext;

  aux!: IOhMyAux;

  /**
   * The active preset's name, for the footer of the detail pane. Resolved here
   * rather than in the pane itself: the name lives on the state, and this page
   * is already subscribed to it.
   */
  public presetName = '';

  ngOnInit(): void {
    this.element.nativeElement.parentNode.scrollTop = 0;
    const dataId = this.activeRoute.snapshot.params.dataId;

    // Both, because the request shown here is a record of its own: editing a
    // response changes the request without changing the state.
    this.subscription = combineLatest([
      this.stateService.state$,
      this.stateService.requests$
    ]).subscribe(([state, requests]: [IState, IOhMyRequests]) => {
      // undefined when the request was removed while this page was open.
      this.data = PageMockComponent.StateUtils.findRequest(state, requests, {
        id: dataId
      }) as IData;
      this.aux = state.aux;
      this.context = state.context;
      this.presetName = state.presets?.[state.context?.preset] ?? '';
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
