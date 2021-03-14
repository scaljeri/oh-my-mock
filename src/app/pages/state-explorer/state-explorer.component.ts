import { Component, OnInit } from '@angular/core';
import {
  ActivatedRoute,
  ActivationStart,
  Event as NavigationEvent,
  Router
} from '@angular/router'
import { Dispatch } from '@ngxs-labs/dispatch-decorator';
import { Select } from '@ngxs/store';
import { domain, IOhMyMock } from '@shared/type';
import { Observable } from 'rxjs';
import { AppStateService } from 'src/app/services/app-state.service';
import { StorageService } from 'src/app/services/storage.service';
import { InitState } from 'src/app/store/actions';
import { OhMyState } from 'src/app/store/state';

@Component({
  selector: 'app-state-explorer',
  templateUrl: './state-explorer.component.html',
  styleUrls: ['./state-explorer.component.scss']
})
export class StateExplorerComponent implements OnInit {
  @Dispatch() initState = (state: IOhMyMock) => new InitState(state);
  @Select(OhMyState.getState) state$: Observable<IOhMyMock>;

  public panelOpenState = true;
  public domains: domain[];
  public selectedDomain: string;

  constructor(
    private appStateService: AppStateService,
    private router: Router,
    private activatedRoute: ActivatedRoute) { }

  ngOnInit(): void {
    this.state$.subscribe((state) => {
      this.domains = Object.keys(state.domains);
    });

    this.router.events.subscribe((event: NavigationEvent) => {
      if (event instanceof ActivationStart) {
        if (event.snapshot.parent.routeConfig.component !== StateExplorerComponent) {
          this.onSelectDomain();
        }
      }
    });
  }

  async onSelectDomain(domain = this.appStateService.domain): Promise<void> {
    this.selectedDomain = domain;
    this.panelOpenState = false;
    // const state = await this.storageService.initialize(domain);
    // this.initState(state);

    setTimeout(() => {
      this.router.navigate([encodeURIComponent(domain)], {
        relativeTo: this.activatedRoute
      });
    });
  }
}
