import { ChangeDetectorRef, Component, ElementRef, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IOhMyRequest, IOhMyAux, IOhMyContext, IOhMyRequestId, IOhMyDomain } from '@shared/type';
import { StateUtils } from '@shared/utils/state';
import { Subscription } from 'rxjs';
import { StorageService } from 'src/app/services/storage.service';
import { OhMyStateService } from '../../services/state.service';

// import { findAutoActiveMock } from 'src/app/utils/data';

@Component({
  selector: 'oh-my-page-mock',
  templateUrl: './mock.component.html',
  styleUrls: ['./mock.component.scss']
})
export class PageMockComponent implements OnInit {
  static StateUtils = StateUtils;
  public data: IOhMyRequest;
  private subscription: Subscription;
  public context: IOhMyContext;

  aux: IOhMyAux;

  // @Dispatch() upsertData = (data: IOhMyRequest) => new UpsertData({ id: this.data.id, ...data }, this.context);

  constructor(private element: ElementRef,
    private activeRoute: ActivatedRoute,
    private stateService: OhMyStateService,
    private storageService: StorageService,
    private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
    this.element.nativeElement.parentNode.scrollTop = 0;
    const dataId = this.activeRoute.snapshot.params.dataId;

    this.subscription = this.stateService.state$.subscribe(async (state: IOhMyDomain) => {
      const requestLookup = (requestId: IOhMyRequestId) => this.storageService.get<IOhMyRequest>(requestId);
      this.data = await PageMockComponent.StateUtils.findRequest(state, { id: dataId }, requestLookup);
      this.aux = state.aux;
      this.context = state.context;
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
